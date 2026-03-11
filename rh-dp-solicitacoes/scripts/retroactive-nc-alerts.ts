import { notifyRetroactiveOpenNonConformities } from '@/lib/sst/nonConformityNotifications'

async function main() {
  const summary = await notifyRetroactiveOpenNonConformities()
  console.info('[retroactive-nc-alerts] concluído', summary)
}

main()
  .catch((error) => {
    console.error('[retroactive-nc-alerts] erro', error)
    process.exitCode = 1
  })