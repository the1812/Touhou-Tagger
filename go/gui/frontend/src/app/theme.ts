import { definePreset } from '@primeuix/themes'
import Aura from '@primeuix/themes/aura'

export const TouhouTaggerPreset = definePreset(Aura, {
  primitive: {
    purple: {
      50: '#f7f5fc',
      100: '#eeeaf9',
      200: '#ddd5f3',
      300: '#bface2',
      400: '#a084dc',
      500: '#7c70cb',
      600: '#645cbb',
      700: '#534a9c',
      800: '#453e80',
      900: '#383468',
      950: '#231f40',
    },
  },
  semantic: {
    primary: {
      50: '{purple.50}',
      100: '{purple.100}',
      200: '{purple.200}',
      300: '{purple.300}',
      400: '{purple.400}',
      500: '{purple.500}',
      600: '{purple.600}',
      700: '{purple.700}',
      800: '{purple.800}',
      900: '{purple.900}',
      950: '{purple.950}',
    },
    focusRing: {
      width: '2px',
      style: 'solid',
      color: '{primary.500}',
      offset: '2px',
      shadow: 'none',
    },
    colorScheme: {
      light: {
        formField: {
          disabledBackground: '#efedf4',
          disabledColor: '#817b89',
        },
      },
      dark: {
        formField: {
          disabledBackground: '#2a2731',
          disabledColor: '#aaa4b2',
        },
      },
    },
  },
  components: {
    autocomplete: {
      css: `
        .p-autocomplete {
          font-size: 0.82rem;
        }

        .p-autocomplete-input-multiple {
          min-height: 34px;
          gap: 0.3rem;
          padding: 0.2rem 0.5rem;
        }

        .p-autocomplete-chip {
          padding: 0.1rem 0.4rem;
          font-size: 0.78rem;
        }

        .p-autocomplete-input-chip input {
          font-size: 0.82rem;
        }
      `,
    },
    dialog: {
      header: {
        padding: '0.9rem 1rem 0.7rem',
        gap: '0.5rem',
      },
      title: {
        fontSize: '1rem',
        fontWeight: '650',
      },
      content: {
        padding: '0 1rem 1rem',
      },
      footer: {
        padding: '0 1rem 1rem',
        gap: '0.5rem',
      },
      css: `
        .p-dialog {
          font-size: 0.82rem;
        }

        .p-dialog .p-dialog-close-button {
          --p-button-icon-only-width: 2rem;
          width: 2rem;
          height: 2rem;
          min-width: 2rem;
          min-height: 2rem;
          padding: 0;
          border-radius: 50%;
        }

        .p-dialog .p-textarea {
          padding: 0.5rem 0.65rem;
          font-size: 0.82rem;
          line-height: 1.45;
        }

        .p-dialog-footer .p-button {
          min-height: 34px;
          padding: 0.45rem 0.7rem;
          font-size: 0.8rem;
          line-height: 1;
        }
      `,
    },
    select: {
      root: {
        sm: {
          fontSize: '0.78rem',
        },
      },
      css: `
        .p-select-label {
          display: flex;
          align-items: center;
          font-size: 0.78rem;
          line-height: 1.2;
        }

        .p-select-overlay,
        .p-select-option {
          font-size: 0.78rem;
        }

        .p-select-option {
          padding: 0.45rem 0.65rem;
        }
      `,
    },
    tooltip: {
      root: {
        padding: '0.35rem 0.55rem',
      },
      css: `
        .p-tooltip {
          font-size: 0.75rem;
          line-height: 1.35;
        }
      `,
    },
  },
})
