import type { Config } from 'tailwindcss';

/**
 * Tailwind se apoya en las variables CSS de src/estilos/tokens.css.
 * Ningun color literal vive aqui: cambiar el tema es cambiar variables, no
 * reescribir clases.
 */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        fondo: 'var(--fondo)',
        'fondo-elevado': 'var(--fondo-elevado)',
        'fondo-sutil': 'var(--fondo-sutil)',
        'fondo-hover': 'var(--fondo-hover)',
        texto: 'var(--texto)',
        'texto-suave': 'var(--texto-suave)',
        'texto-tenue': 'var(--texto-tenue)',
        borde: 'var(--borde)',
        'borde-fuerte': 'var(--borde-fuerte)',
        acento: 'var(--acento)',
        'acento-suave': 'var(--acento-suave)',
        'acento-contraste': 'var(--acento-contraste)',
        validado: 'var(--validado)',
        'validado-suave': 'var(--validado-suave)',
        'sin-validar': 'var(--sin-validar)',
        'sin-validar-suave': 'var(--sin-validar-suave)',
        peligro: 'var(--peligro)',
      },
      fontFamily: {
        // Serif = texto del manual. Sans = todo lo demas y lo que anade el usuario.
        manual: 'var(--fuente-manual)',
        propia: 'var(--fuente-propia)',
        mono: 'var(--fuente-mono)',
      },
      maxWidth: {
        lectura: 'var(--medida-lectura)',
      },
      spacing: {
        'barra-lateral': 'var(--ancho-barra-lateral)',
      },
      borderRadius: {
        sm: '3px',
        DEFAULT: '5px',
        md: '7px',
        lg: '10px',
      },
      transitionDuration: {
        DEFAULT: '120ms',
      },
      zIndex: {
        barra: '30',
        cabecera: '40',
        superposicion: '50',
        dialogo: '60',
      },
    },
  },
  plugins: [],
} satisfies Config;
