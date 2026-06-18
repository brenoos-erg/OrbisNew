import { notifyRetroactiveOpenNonConformities } from '@/lib/sst/nonConformityNotifications'

async function main() {
  const confirm = process.argv.includes('--confirm') || process.env.NC_RETROACTIVE_ALERTS_CONFIRM === 'true'
  const summary = await notifyRetroactiveOpenNonConformities({ confirm })
  console.info('[retroactive-nc-alerts] concluído', summary)
}

main()
  .catch((error) => {
    console.error('[retroactive-nc-alerts] erro', error)
    process.exitCode = 1
  })