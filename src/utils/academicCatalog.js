export const DEFAULT_INSTITUTES = Object.freeze([
  {
    code: 'ICS', name: 'Institute of Computing Studies', shortName: 'ICS', programs: [
      { code: 'BSIT', name: 'Bachelor of Science in Information Technology', abbr: 'BSIT' },
      { code: 'BSIS', name: 'Bachelor of Science in Information Systems', abbr: 'BSIS' }
    ]
  },
  {
    code: 'ISCJS', name: 'Institute of Social and Criminal Justice Studies', shortName: 'ISCJS', programs: [
      { code: 'BSCRIM', name: 'Bachelor of Science in Criminology', abbr: 'BSCRIM' }
    ]
  },
  {
    code: 'IVTES', name: 'Institute of Vocational and Technical Education Studies', shortName: 'IVTES', programs: [
      { code: 'BTVTED', name: 'Bachelor of Technical-Vocational Teacher Education', abbr: 'BTVTED' },
      { code: 'BTLED', name: 'Bachelor of Technology and Livelihood Education', abbr: 'BTLED' },
      { code: 'BSHM', name: 'Bachelor of Science in Hospitality Management', abbr: 'BSHM' },
      { code: 'BSHRRM', name: 'Bachelor of Science in Hotel and Restaurant Resource Management', abbr: 'BSHRRM' },
      { code: 'BSHT', name: 'Bachelor of Science in Hospitality and Tourism', abbr: 'BSHT' }
    ]
  },
  {
    code: 'IAS', name: 'Institute of Agricultural Sciences', shortName: 'IAS', programs: [
      { code: 'BSA', name: 'Bachelor of Science in Agriculture', abbr: 'BSA' },
      { code: 'BSF', name: 'Bachelor of Science in Forestry', abbr: 'BSF' },
      { code: 'BSAB', name: 'Bachelor of Science in Agribusiness', abbr: 'BSAB' }
    ]
  },
  {
    code: 'GS', name: 'Graduate Studies', shortName: 'GS', programs: [
      { code: 'MAEd', name: 'Master of Arts in Education', abbr: 'MAEd' },
      { code: 'MSA', name: 'Master of Science in Agriculture', abbr: 'MSA' },
      { code: 'MSAgEd', name: 'Master of Science in Agricultural Education', abbr: 'MSAgEd' },
      { code: 'MSAg.Mgt.', name: 'Master of Science in Agricultural Management', abbr: 'MSAg.Mgt.' }
    ]
  }
]);

export const normalizeInstitutes = (institutes) => {
  const source = Array.isArray(institutes) && institutes.length ? institutes : DEFAULT_INSTITUTES;
  return source.map((institute) => ({
    code: String(institute?.code || '').trim().toUpperCase(),
    name: String(institute?.name || '').trim(),
    shortName: String(institute?.shortName || institute?.code || '').trim(),
    programs: Array.isArray(institute?.programs) ? institute.programs.map((program) => ({
      code: String(program?.code || '').trim().toUpperCase(),
      name: String(program?.name || '').trim(),
      abbr: String(program?.abbr || program?.code || '').trim()
    })).filter((program) => program.code && program.name) : []
  })).filter((institute) => institute.code && institute.name);
};