// Next.js Server Lifecycle Instrumentation Hook
// Executes once when the Node.js server starts up

export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { validateEnvStartup } = await import('./config/env');
    try {
      validateEnvStartup();
      console.log('✓ [Dhun] Server environment validated successfully');
    } catch (err: any) {
      console.error(err.message);
      if (process.env.NODE_ENV === 'production') {
        process.exit(1);
      }
    }
  }
}
