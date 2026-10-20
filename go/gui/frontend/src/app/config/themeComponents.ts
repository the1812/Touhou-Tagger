export const themeComponents = {
  button: {
    root: {
      iconOnlyWidth: '34px',
    },
    colorScheme: {
      light: {
        root: {
          primary: {
            color: '{surface.0}',
            hoverColor: '{surface.0}',
            activeColor: '{surface.0}',
          },
        },
      },
      dark: {
        root: {
          primary: {
            background: '{primary.500}',
            hoverBackground: '{primary.600}',
            activeBackground: '{primary.700}',
            borderColor: '{primary.500}',
            hoverBorderColor: '{primary.600}',
            activeBorderColor: '{primary.700}',
            color: '{surface.0}',
            hoverColor: '{surface.0}',
            activeColor: '{surface.0}',
          },
        },
      },
    },
  },
  datatable: {
    colorScheme: {
      light: {
        row: {
          hoverBackground: '{primary.50}',
        },
      },
      dark: {
        root: {
          borderColor: '{content.border.color}',
        },
        row: {
          hoverBackground: 'color-mix(in srgb, {primary.400} 12%, {content.background})',
        },
      },
    },
  },
  image: {
    toolbar: {
      background: 'rgba(0, 0, 0, 0.75)',
    },
  },
  tooltip: {
    root: {
      gutter: '4px',
    },
  },
}
