export const OFFICIAL_DEPARTMENTS = [
  { code: '06', name: 'Fiscal', sigla: 'FISCAL' },
  { code: '10', name: 'Financeiro', sigla: 'FIN' },
  { code: '11', name: 'Logística', sigla: 'LOG' },
  { code: '12', name: 'Almoxarifado', sigla: 'ALMOX' },
  { code: '17', name: 'Recursos Humanos', sigla: 'RH' },
  { code: '08', name: 'Departamento Pessoal', sigla: 'DP' },
  { code: '20', name: 'Tecnologia da Informação', sigla: 'TI' },
  { code: '19', name: 'Segurança do Trabalho', sigla: 'SST' },
  { code: '21', name: 'Saúde Ocupacional', sigla: 'SAUDE' },
] as const

export const OFFICIAL_DEPARTMENT_CODES = OFFICIAL_DEPARTMENTS.map((item) => item.code)