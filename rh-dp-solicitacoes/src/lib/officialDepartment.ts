export const OFFICIAL_DEPARTMENTS = [
  { code: '11', name: 'Logística', sigla: 'LOG' },
  { code: '17', name: 'Recursos Humanos', sigla: 'RH' },
  { code: '08', name: 'Departamento Pessoal', sigla: 'DP' },
  { code: '20', name: 'Tecnologia da Informação', sigla: 'TI' },
  { code: '19', name: 'Segurança do Trabalho', sigla: 'SST' },
] as const

export const OFFICIAL_DEPARTMENT_CODES = OFFICIAL_DEPARTMENTS.map((item) => item.code)