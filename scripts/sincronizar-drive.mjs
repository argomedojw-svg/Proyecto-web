/**
 * Copia el proyecto (sin node_modules) a la carpeta de Google Drive, para tener
 * copia de seguridad. El proyecto NO puede ejecutarse desde Drive: su sistema de
 * archivos virtual no admite enlaces simbolicos ni junctions y npm no consigue
 * extraer node_modules ahi.
 */

import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';

const ORIGEN = resolve(import.meta.dirname, '..');
const DESTINO = process.env.DSM_DRIVE ?? 'G:\\Mi unidad\\Libros\\DSM5-TR\\Proyecto web';

const EXCLUIR_DIR = ['node_modules', '.git', 'dist', '.vite'];
const EXCLUIR_ARCH = ['informe.txt'];

console.log(`Copiando\n  de ${ORIGEN}\n  a  ${DESTINO}\n`);

const r = spawnSync(
  'robocopy',
  [
    ORIGEN,
    DESTINO,
    '/MIR',
    '/XD',
    ...EXCLUIR_DIR,
    '/XF',
    ...EXCLUIR_ARCH,
    '/NFL',
    '/NDL',
    '/NJH',
    '/R:2',
    '/W:1',
  ],
  { stdio: 'inherit' },
);

// robocopy usa codigos < 8 para exito (0 = sin cambios, 1 = copiados, etc.).
const codigo = r.status ?? 16;
if (codigo >= 8) {
  console.error(`\nrobocopy devolvió ${codigo}: la copia falló.`);
  process.exit(1);
}
console.log(`\nCopia terminada (robocopy ${codigo}).`);
