-- Replace the known legacy MSU-TCTO registrar contact address with the TRAC contact.
-- Review the affected row before applying this migration to production.

update public.system_settings
set contact_email = 'registrar@trac.edu.ph'
where lower(trim(contact_email)) in (
  'registraroffice@msutcto.edu.ph',
  'registrar@msutcto.edu.ph'
);