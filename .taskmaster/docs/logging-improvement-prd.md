# Task Master VS Code Extension - Logging System Improvement PRD

## Executive Summary

The Task Master VS Code Extension currently has an inadequate logging system that hinders debugging, monitoring, and user support. While a basic logging infrastructure exists in `src/utils/logger.ts`, it's underutilized across the codebase, lacks structured logging capabilities, and provides insufficient observability for both developers and users.

## Problem Statement

### Current State Analysis

**Existing Logging Infrastructure:**

- ✅ Basic logger utility exists (`src/utils/logger.ts`)
- ✅ VS Code configuration support (`taskMaster.enableLogging`)
- ✅ Output channel integration
- ✅ Test environment detection

**Critical Gaps Identified:**

1. **Inconsistent Usage**

   - Only 5 out of 16 source files import the logger
   - 120+ instances of direct `console.log`/`console.error` calls
   - No logging in critical services: `configService`, `securityService`, `statusBarService`, etc.

2. **Limited Log Levels**

   - Only supports `INFO` and `ERROR` levels
   - No `DEBUG`, `WARN`, or `TRACE` levels
   - No structured logging capabilities

3. **Poor Contextual Information**

   - Logs lack operation context (user actions, command execution)
   - No correlation IDs for tracking operations
   - No performance metrics or timing data

4. **Inadequate Error Handling**

   - CLI errors are poorly captured and reported
   - No centralized error logging strategy
   - User-facing errors lack diagnostic context

5. **Missing Observability**
   - No metrics collection for extension usage
   - No audit trail for critical operations
   - No debugging aids for complex workflows

## Requirements

### Functional Requirements

#### FR1: Enhanced Log Levels

- **Requirement:** Support multiple log levels: `TRACE`, `DEBUG`, `INFO`, `WARN`, `ERROR`, `FATAL`
- **Priority:** High
- **Rationale:** Different information types require different visibility levels

#### FR2: Structured Logging

- **Requirement:** Support structured log data with consistent format
- **Priority:** High
- **Rationale:** Enable automated log analysis and better searchability

#### FR3: Contextual Logging

- **Requirement:** Include operation context in all log entries
- **Priority:** High
- **Rationale:** Enable tracing complex operations across services

#### FR4: Performance Logging

- **Requirement:** Log operation timing and performance metrics
- **Priority:** Medium
- **Rationale:** Identify performance bottlenecks and monitor CLI operations

#### FR5: Security-Aware Logging

- **Requirement:** Implement secure logging that respects workspace trust
- **Priority:** High
- **Rationale:** Align with existing security framework

#### FR6: User-Friendly Error Reporting

- **Requirement:** Provide actionable error messages to users
- **Priority:** High
- **Rationale:** Improve user experience and reduce support burden

### Non-Functional Requirements

#### NFR1: Performance

- Logging overhead must not exceed 5% of operation time
- Asynchronous logging for non-critical operations

#### NFR2: Configuration

- Granular log level configuration per component
- Runtime log level adjustment without restart

#### NFR3: Storage

- Configurable log retention policies
- Option to save logs to file for debugging

#### NFR4: Privacy

- No sensitive data (API keys, file contents) in logs
- Compliance with VS Code marketplace requirements

## Technical Design

### Architecture Overview

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   Components    │────│   Logger Core    │────│   Log Outputs   │
│                 │    │                  │    │                 │
│ • Services      │    │ • Level Control  │    │ • Output Channel│
│ • Commands      │    │ • Formatting     │    │ • Console       │
│ • Providers     │    │ • Context Mgmt   │    │ • File (opt)    │
└─────────────────┘    └──────────────────┘    └─────────────────┘
```

### Core Components

#### 1. Enhanced Logger Interface

```typescript
interface ILogger {
  trace(message: string, context?: LogContext): void;
  debug(message: string, context?: LogContext): void;
  info(message: string, context?: LogContext): void;
  warn(message: string, context?: LogContext): void;
  error(message: string, error?: Error, context?: LogContext): void;
  fatal(message: string, error?: Error, context?: LogContext): void;

  // Performance logging
  time(operationId: string): void;
  timeEnd(operationId: string): void;

  // Contextual operations
  child(context: Partial<LogContext>): ILogger;
}

interface LogContext {
  operation?: string;
  correlationId?: string;
  userId?: string;
  component?: string;
  taskId?: string;
  duration?: number;
  metadata?: Record<string, any>;
}
```

#### 2. Log Categories

```typescript
enum LogCategory {
  CLI = "cli",
  TASK = "task",
  TAG = "tag",
  DEPENDENCY = "dependency",
  SECURITY = "security",
  CONFIG = "config",
  UI = "ui",
  PERFORMANCE = "performance",
  ERROR = "error",
}
```

#### 3. Configuration Schema

```typescript
interface LoggingConfig {
  enabled: boolean;
  level: LogLevel;
  categories: Record<LogCategory, LogLevel>;
  outputs: {
    console: boolean;
    outputChannel: boolean;
    file?: {
      enabled: boolean;
      path: string;
      maxSize: number;
      maxFiles: number;
    };
  };
  format: "simple" | "structured" | "json";
  includeTimestamp: boolean;
  includeContext: boolean;
}
```

### Implementation Plan

#### Phase 1: Core Logger Enhancement (Week 1-2)

1. **Enhance `logger.ts`**

   - Add log levels enum and configuration
   - Implement structured logging format
   - Add performance timing utilities
   - Create context management

2. **Update VS Code Configuration**
   - Add granular log level settings
   - Add category-specific configuration
   - Add output format options

#### Phase 2: Service Integration (Week 3-4)

1. **Critical Services Integration**

   - `CLIService`: CLI operation logging with timing
   - `TaskManagerService`: Task operation lifecycle logging
   - `SecurityService`: Security event logging
   - `ConfigService`: Configuration change logging

2. **Error Handling Centralization**
   - Create centralized error logger
   - Implement error categorization
   - Add user-friendly error messaging

#### Phase 3: Command and Provider Integration (Week 5-6)

1. **Command Logging**

   - Replace all `console.*` calls in commands
   - Add operation context to all commands
   - Implement user action audit trail

2. **Provider Logging**
   - `TaskTreeProvider`: Tree update and rendering logs
   - Add performance logging for tree operations

#### Phase 4: Advanced Features (Week 7-8)

1. **Performance Monitoring**

   - CLI execution timing
   - Tree rendering performance
   - File operation timing

2. **Advanced Diagnostics**
   - Health check logging
   - Extension lifecycle logging
   - Memory usage tracking

## Implementation Details

### Example Implementation

#### Enhanced Logger Service

```typescript
// src/utils/enhancedLogger.ts
export class EnhancedLogger implements ILogger {
  private config: LoggingConfig;
  private context: LogContext;
  private timers: Map<string, number> = new Map();

  constructor(config: LoggingConfig, context: LogContext = {}) {
    this.config = config;
    this.context = context;
  }

  info(message: string, context?: LogContext): void {
    this.log(LogLevel.INFO, message, undefined, context);
  }

  error(message: string, error?: Error, context?: LogContext): void {
    this.log(LogLevel.ERROR, message, error, context);
  }

  time(operationId: string): void {
    this.timers.set(operationId, Date.now());
  }

  timeEnd(operationId: string): void {
    const startTime = this.timers.get(operationId);
    if (startTime) {
      const duration = Date.now() - startTime;
      this.info(`Operation completed: ${operationId}`, { duration });
      this.timers.delete(operationId);
    }
  }

  child(context: Partial<LogContext>): ILogger {
    return new EnhancedLogger(this.config, { ...this.context, ...context });
  }

  private log(
    level: LogLevel,
    message: string,
    error?: Error,
    context?: LogContext
  ): void {
    if (!this.shouldLog(level)) return;

    const logEntry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      context: { ...this.context, ...context },
      error: error
        ? {
            name: error.name,
            message: error.message,
            stack: error.stack,
          }
        : undefined,
    };

    this.writeLog(logEntry);
  }
}
```

#### Service Integration Example

```typescript
// src/services/cliService.ts
export class CLIService {
  private logger: ILogger;

  constructor() {
    this.logger = getLogger().child({ component: "CLIService" });
  }

  async executeCommand(command: string, options: any): Promise<any> {
    const operationId = `cli-${command}-${Date.now()}`;
    const correlationId = generateCorrelationId();

    const operationLogger = this.logger.child({
      operation: command,
      correlationId,
    });

    operationLogger.info(`Starting CLI command: ${command}`, { options });
    operationLogger.time(operationId);

    try {
      const result = await this.internalExecuteCommand(command, options);

      operationLogger.timeEnd(operationId);
      operationLogger.info(`CLI command completed successfully: ${command}`);

      return result;
    } catch (error) {
      operationLogger.timeEnd(operationId);
      operationLogger.error(`CLI command failed: ${command}`, error);
      throw error;
    }
  }
}
```

### Migration Strategy

#### Step 1: Gradual Replacement

- Replace `console.*` calls one service at a time
- Maintain backward compatibility during transition
- Test each service individually

#### Step 2: Configuration Migration

- Update VS Code settings schema
- Provide migration path for existing configurations
- Default to current behavior for existing users

#### Step 3: Documentation and Training

- Update developer documentation
- Create logging best practices guide
- Provide examples for each service type

## Success Metrics

### Technical Metrics

- **Code Coverage**: 100% of services and commands using structured logging
- **Performance**: <5% overhead from logging operations
- **Error Reduction**: 50% reduction in "unable to reproduce" bug reports

### User Experience Metrics

- **Error Clarity**: User-actionable error messages for 90% of common failures
- **Debug Efficiency**: 75% reduction in time to diagnose user issues
- **Extension Reliability**: Improved crash detection and recovery

### Developer Experience Metrics

- **Debug Speed**: 60% reduction in time to identify and fix bugs
- **Log Searchability**: 100% of operations traceable through structured logs
- **Maintenance**: Centralized logging configuration and management

## Risks and Mitigation

### Risk 1: Performance Impact

- **Mitigation**: Implement asynchronous logging for non-critical operations
- **Monitoring**: Add performance benchmarks to CI/CD pipeline

### Risk 2: Log Spam

- **Mitigation**: Implement intelligent log level defaults and rate limiting
- **Controls**: Provide granular category-based configuration

### Risk 3: Privacy Concerns

- **Mitigation**: Implement data sanitization and configurable privacy modes
- **Compliance**: Regular audit of logged data content

### Risk 4: Development Overhead

- **Mitigation**: Provide clear guidelines and automated tooling
- **Support**: Create reusable logging patterns and templates

## Timeline

| Phase     | Duration    | Deliverables                         |
| --------- | ----------- | ------------------------------------ |
| Phase 1   | 2 weeks     | Enhanced logger core, VS Code config |
| Phase 2   | 2 weeks     | Critical services integration        |
| Phase 3   | 2 weeks     | Commands and providers integration   |
| Phase 4   | 2 weeks     | Advanced features and optimization   |
| **Total** | **8 weeks** | **Complete logging system overhaul** |

## Dependencies

### Technical Dependencies

- VS Code Extension API (already available)
- TypeScript 5.4+ (already available)
- Node.js file system APIs (for optional file logging)

### Team Dependencies

- Development team for implementation
- QA team for testing and validation
- Technical writing for documentation updates

## Post-Implementation

### Monitoring and Maintenance

- Regular log analysis for optimization opportunities
- User feedback collection on error message clarity
- Performance monitoring and tuning

### Future Enhancements

- Integration with external monitoring tools
- Automated log analysis and alerting
- Machine learning-based error prediction

---

**Document Version**: 1.0
**Created**: {{ current_date }}
**Authors**: AI Development Assistant
**Stakeholders**: Task Master Extension Development Team
