/**
 * Sentry client-side configuration
 * Only active when NEXT_PUBLIC_SENTRY_DSN is set.
 */
import * as Sentry from "@sentry/nextjs";

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;

if (dsn) {
  Sentry.init({
    dsn,
    environment: process.env.NODE_ENV ?? "development",
    tracesSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 1.0,
    // Don't send PII
    beforeSend(event) {
      // Strip auth tokens from breadcrumbs
      if (event.request?.cookies) {
        event.request.cookies = {};
      }
      return event;
    },
  });
}
