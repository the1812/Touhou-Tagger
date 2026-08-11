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
  },
})
