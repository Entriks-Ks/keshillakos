// Must be the first import in src/index.ts: ES imports are hoisted, so env
// has to be loaded inside an imported module, not as a statement after imports.
import dotenv from 'dotenv'

dotenv.config({ override: true })
