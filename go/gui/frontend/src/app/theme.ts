import { definePreset } from '@primeuix/themes'
import Aura from '@primeuix/themes/aura'

export const TouhouTaggerPreset = definePreset(Aura, {
  components: {
    tooltip: {
      root: {
        gutter: '4px',
      },
    },
  },
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
          0: '#f4f3f7',
          50: '#e8e6ec',
          100: '#d7d4dd',
          200: '#c8c4ce',
          300: '#bbb7c3',
          400: '#aaa6b2',
          500: '#85808d',
          600: '#5a5363',
          700: '#332e3b',
          800: '#211d2a',
          900: '#15131a',
          950: '#0d0c11',
        },
        formField: {
          background: '#0d0c11',
          disabledBackground: '#1b1821',
          disabledColor: '#aaa6b2',
          borderColor: '#5a5363',
          hoverBorderColor: '#716a79',
          color: '#f4f3f7',
          placeholderColor: '#aaa6b2',
          iconColor: '#aaa6b2',
        },
        text: {
          color: '#f4f3f7',
          hoverColor: '#ffffff',
          mutedColor: '#bbb7c3',
          hoverMutedColor: '#d7d4dd',
        },
        content: {
          background: '#15131a',
          hoverBackground: '#211e29',
          borderColor: '#332e3b',
          color: '#f4f3f7',
          hoverColor: '#ffffff',
        },
        overlay: {
          select: {
            background: '#15131a',
            borderColor: '#332e3b',
            color: '#f4f3f7',
          },
          popover: {
            background: '#15131a',
            borderColor: '#332e3b',
            color: '#f4f3f7',
          },
          modal: {
            background: '#15131a',
            borderColor: '#332e3b',
            color: '#f4f3f7',
          },
        },
      },
    },
  },
})
