declare namespace Cloudflare {
  interface Env {
    DB?: D1Database;
    VEIL_LOCAL_TEST?: string;
    BUCKET?: R2Bucket;
  }
}
