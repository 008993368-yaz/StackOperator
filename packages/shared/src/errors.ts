export class AppError extends Error {
  readonly code: string;
  readonly retryable: boolean;

  constructor(code: string, message: string, retryable = false) {
    super(message);
    this.name = "AppError";
    this.code = code;
    this.retryable = retryable;
  }
}

export class ValidationError extends AppError {
  constructor(message: string) {
    super("VALIDATION_ERROR", message, false);
    this.name = "ValidationError";
  }
}

export class GitHubError extends AppError {
  constructor(message: string, retryable = true) {
    super("GITHUB_ERROR", message, retryable);
    this.name = "GitHubError";
  }
}
