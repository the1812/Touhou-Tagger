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
        surface: {
          0: '#ffffff',
          50: '#f8f7fb',
          100: '#f1eef9',
          200: '#e4e1eb',
          300: '#c9c4d2',
          400: '#918b9a',
          500: '#6f6a79',
          600: '#55505e',
          700: '#302d3d',
          800: '#2f2c4e',
          900: '#201e27',
          950: '#17161d',
        },
        formField: {
          background: '{surface.0}',
          disabledBackground: '#efedf4',
          disabledColor: '#817b89',
          borderColor: '#e4e1eb',
          hoverBorderColor: '#c9c4d2',
          color: '#302d3d',
          placeholderColor: '#918b9a',
          iconColor: '#918b9a',
        },
        text: {
          color: '#302d3d',
          hoverColor: '#2f2c4e',
          mutedColor: '#6f6a79',
          hoverMutedColor: '#55505e',
        },
        content: {
          background: '#ffffff',
          hoverBackground: '#f1eef9',
          borderColor: '#e4e1eb',
          color: '#302d3d',
          hoverColor: '#2f2c4e',
        },
        overlay: {
          select: {
            background: '#ffffff',
            borderColor: '#e4e1eb',
            color: '#302d3d',
          },
          popover: {
            background: '#ffffff',
            borderColor: '#e4e1eb',
            color: '#302d3d',
          },
          modal: {
            background: '#ffffff',
            borderColor: '#e4e1eb',
            color: '#302d3d',
          },
        },
      },
      dark: {
        surface: {
          0: '#eeebf4',
          50: '#e1dce8',
          100: '#cec8d6',
          200: '#bdb7c5',
          300: '#b0aab8',
          400: '#89828f',
          500: '#6d6673',
          600: '#55505e',
          700: '#383440',
          800: '#27242e',
          900: '#201e27',
          950: '#17161d',
        },
        formField: {
          background: '#17161d',
          disabledBackground: '#2a2731',
          disabledColor: '#aaa4b2',
          borderColor: '#55505e',
          hoverBorderColor: '#6d6673',
          color: '#eeebf4',
          placeholderColor: '#89828f',
          iconColor: '#89828f',
        },
        text: {
          color: '#eeebf4',
          hoverColor: '#ffffff',
          mutedColor: '#b0aab8',
          hoverMutedColor: '#cec8d6',
        },
        content: {
          background: '#201e27',
          hoverBackground: '#2b2736',
          borderColor: '#383440',
          color: '#eeebf4',
          hoverColor: '#ffffff',
        },
        overlay: {
          select: {
            background: '#201e27',
            borderColor: '#383440',
            color: '#eeebf4',
          },
          popover: {
            background: '#201e27',
            borderColor: '#383440',
            color: '#eeebf4',
          },
          modal: {
            background: '#201e27',
            borderColor: '#383440',
            color: '#eeebf4',
          },
        },
      },
    },
  },
  components: {
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
    },
    select: {
      root: {
        sm: {
          fontSize: '0.78rem',
        },
      },
    },
    tooltip: {
      root: {
        padding: '0.35rem 0.55rem',
      },
    },
  },
})
