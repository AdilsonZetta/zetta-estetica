import { execFileSync } from 'node:child_process'
import { writeFileSync } from 'node:fs'
const output = execFileSync('node_modules/.bin/supabase', ['gen','types','typescript','--db-url','postgresql://postgres@localhost:54322/zetta','--schema','public'], { encoding:'utf8' })
writeFileSync('src/database.types.ts', output.replace(/[ \t]+$/gm,'').trimStart())
