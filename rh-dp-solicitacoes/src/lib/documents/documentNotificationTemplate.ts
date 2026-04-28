export function renderDocumentNotificationTemplate(template: string, vars: Record<string, string>) {
  let output = template
  Object.entries(vars).forEach(([key, value]) => {
    output = output.replaceAll(`{${key}}`, value ?? '-')
  })
  return output
}
