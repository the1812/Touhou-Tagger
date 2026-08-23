import { twMerge } from 'tailwind-merge'
import { normalizeClass, type ClassValue } from 'vue'

type CxValue = ClassValue | false | null | undefined

export const cx = (...values: CxValue[]) =>
  twMerge(normalizeClass(values.filter(Boolean) as ClassValue[]))
