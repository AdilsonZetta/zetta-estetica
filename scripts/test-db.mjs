import { execFileSync } from 'node:child_process'
import { readdirSync } from 'node:fs'
for (const file of readdirSync('supabase/tests').filter(f => f.endsWith('.sql'))) {
  const output = execFileSync('psql', ['-X','-h','localhost','-p','54322','-U','postgres','-d','zetta','-v','ON_ERROR_STOP=1','-At','-f',`supabase/tests/${file}`], { encoding: 'utf8' })
  console.log(output.split('\n').filter(l => /^(ok |not ok |1\.\.|#)/.test(l)).join('\n'))
  const plan = output.match(/^1\.\.(\d+)$/m)
  const passed = output.match(/^ok \d+/gm) || []
  if (/^not ok |^# (Looks like|Failed)/m.test(output) || !plan || passed.length !== Number(plan[1])) process.exitCode = 1
}
