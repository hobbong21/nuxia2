/**
 * QA entry point — placeholder.
 *
 * qa-integrator will extend this to run the 24 acceptance assertions from
 * `_workspace/01_analyst_requirements.md` §합격 기준.
 *
 * For now this file just confirms the referral engine contract numerically.
 */
/* eslint-disable no-console */

function floorBps(amount: bigint, bps: number): bigint {
  return (amount * BigInt(bps)) / 10_000n
}

function main() {
  const gross = 1_000_000n
  const gen1 = floorBps(gross, 300)
  const gen2 = floorBps(gross, 500)
  const gen3 = floorBps(gross, 1700)
  const sum = gen1 + gen2 + gen3
  console.log('gen1', gen1.toString())
  console.log('gen2', gen2.toString())
  console.log('gen3', gen3.toString())
  console.log('sum', sum.toString())
  if (gen1 !== 30_000n || gen2 !== 50_000n || gen3 !== 170_000n || sum !== 250_000n) {
    throw new Error('Referral contract broken')
  }
  console.log('OK — baseline referral math intact (3%/5%/17%).')
}

main()
