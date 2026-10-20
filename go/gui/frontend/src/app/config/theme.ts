import { definePreset } from '@primeuix/themes'
import Aura from '@primeuix/themes/aura'

import { themeComponents } from './themeComponents'

export const TouhouTaggerPreset = definePreset(Aura, {
  components: themeComponents,
  primitive: {
    purple: {
      50: 'oklch(97.5% 0.01 284.1281)',
      100: 'oklch(94.5% 0.022 284.1281)',
      200: 'oklch(89% 0.044 284.1281)',
      300: 'oklch(78% 0.085 284.1281)',
      400: 'oklch(67.4606% 0.129625 284.1281)',
      500: 'oklch(60% 0.14 284.1281)',
      600: 'oklch(52.9884% 0.144507 284.1281)',
      700: 'oklch(45.5% 0.13 284.1281)',
      800: 'oklch(39% 0.108 284.1281)',
      900: 'oklch(33% 0.084 284.1281)',
      950: 'oklch(24.5% 0.055 284.1281)',
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
          50: 'oklch(97.803% 0.002 284.1281)',
          100: 'oklch(95.4602% 0.003 284.1281)',
          200: 'oklch(91.4994% 0.004 284.1281)',
          300: 'oklch(82.8564% 0.006 284.1281)',
          400: 'oklch(64.6821% 0.008 284.1281)',
          500: 'oklch(53.4042% 0.009 284.1281)',
          600: 'oklch(44.1216% 0.01 284.1281)',
          700: 'oklch(30.7227% 0.01 284.1281)',
          800: 'oklch(27.4232% 0.01 284.1281)',
          900: 'oklch(24.1238% 0.01 284.1281)',
          950: 'oklch(20.457% 0.01 284.1281)',
        },
        formField: {
          background: '{surface.0}',
          disabledBackground: '{surface.100}',
          disabledColor: '{surface.500}',
          borderColor: '{surface.200}',
          hoverBorderColor: '{surface.300}',
          color: '{surface.700}',
          placeholderColor: '{surface.400}',
          iconColor: '{surface.400}',
        },
        text: {
          color: '{surface.700}',
          hoverColor: '{surface.800}',
          mutedColor: '{surface.500}',
          hoverMutedColor: '{surface.600}',
        },
        content: {
          background: '{surface.0}',
          hoverBackground: '{surface.100}',
          borderColor: '{surface.200}',
          color: '{surface.700}',
          hoverColor: '{surface.800}',
        },
        overlay: {
          select: {
            background: '{surface.0}',
            borderColor: '{surface.200}',
            color: '{surface.700}',
          },
          popover: {
            background: '{surface.0}',
            borderColor: '{surface.200}',
            color: '{surface.700}',
          },
          modal: {
            background: '{surface.0}',
            borderColor: '{surface.200}',
            color: '{surface.700}',
          },
        },
      },
      dark: {
        surface: {
          0: '#ffffff',
          50: 'oklch(92.8211% 0.01 284.1281)',
          100: 'oklch(87.4952% 0.01 284.1281)',
          200: 'oklch(82.6516% 0.01 284.1281)',
          300: 'oklch(78.6353% 0.01 284.1281)',
          400: 'oklch(73.2208% 0.01 284.1281)',
          500: 'oklch(60.8529% 0.01 284.1281)',
          600: 'oklch(45.4828% 0.01 284.1281)',
          700: 'oklch(31.1859% 0.01 284.1281)',
          800: 'oklch(24.1293% 0.01 284.1281)',
          900: 'oklch(19.2388% 0.01 284.1281)',
          950: 'oklch(15.8019% 0.01 284.1281)',
        },
        formField: {
          background: '{surface.950}',
          disabledBackground: '{surface.900}',
          disabledColor: '{surface.400}',
          borderColor: '{surface.700}',
          hoverBorderColor: '{surface.600}',
          color: '{surface.0}',
          placeholderColor: '{surface.400}',
          iconColor: '{surface.400}',
        },
        text: {
          color: '{surface.0}',
          hoverColor: '{surface.0}',
          mutedColor: '{surface.300}',
          hoverMutedColor: '{surface.100}',
        },
        content: {
          background: '{surface.900}',
          hoverBackground: '{surface.800}',
          borderColor: '{surface.700}',
          color: '{surface.0}',
          hoverColor: '{surface.0}',
        },
        overlay: {
          select: {
            background: '{surface.900}',
            borderColor: '{surface.700}',
            color: '{surface.0}',
          },
          popover: {
            background: '{surface.900}',
            borderColor: '{surface.700}',
            color: '{surface.0}',
          },
          modal: {
            background: '{surface.900}',
            borderColor: '{surface.700}',
            color: '{surface.0}',
          },
        },
      },
    },
  },
})
