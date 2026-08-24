/** @type {import('next').NextConfig} */
const nextConfig = {
  // Native and browser-launching packages must stay outside the bundler.
  serverExternalPackages: [
    '@libsql/client',
    'puppeteer',
    'puppeteer-core',
    '@sparticuz/chromium',
  ],
  outputFileTracingIncludes: {
    // The serverless Chromium ships as a brotli archive that the tracer does not
    // follow on its own; without this the PDF route deploys with no browser to run.
    '/api/prd/[id]/export/pdf': ['./node_modules/@sparticuz/chromium/**'],
  },
};

export default nextConfig;
