export const nodeTypePalette = {
  root: {
    strong: 'text-[#545A64]',
    soft: 'bg-[#F5F4F1] border-[#D8D4CC]',
    badge: 'border-[#D8D4CC] text-[#545A64] bg-[#F5F4F1]',
  },
  alpha: {
    strong: 'text-[#2F6B66]',
    soft: 'bg-[#2F6B66]/10 border-[#2F6B66]/25',
    badge: 'border-[#2F6B66]/25 text-[#2F6B66] bg-[#2F6B66]/10',
  },
  beta: {
    strong: 'text-[#4A5A78]',
    soft: 'bg-[#4A5A78]/10 border-[#4A5A78]/20',
    badge: 'border-[#4A5A78]/20 text-[#4A5A78] bg-[#4A5A78]/10',
  },
  production: {
    strong: 'text-[#6E59A5]',
    soft: 'bg-[#6E59A5]/10 border-[#6E59A5]/20',
    badge: 'border-[#6E59A5]/20 text-[#6E59A5] bg-[#6E59A5]/10',
  },
} as const

export type NodePaletteType = keyof typeof nodeTypePalette
