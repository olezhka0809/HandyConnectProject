import {
  Zap, Wrench, Paintbrush, Hammer, Droplets,
  TreePine, Truck, Cpu, ShieldCheck, HelpCircle
} from 'lucide-react'

// Map category name -> icon + bg color
const CATEGORY_MAP = {
  'electrician':    { Icon: Zap,         bg: 'bg-yellow-100', color: 'text-yellow-600' },
  'electric':       { Icon: Zap,         bg: 'bg-yellow-100', color: 'text-yellow-600' },
  'instalatii':     { Icon: Droplets,    bg: 'bg-blue-100',   color: 'text-blue-600'   },
  'plumbing':       { Icon: Droplets,    bg: 'bg-blue-100',   color: 'text-blue-600'   },
  'zugravit':       { Icon: Paintbrush,  bg: 'bg-pink-100',   color: 'text-pink-600'   },
  'vopsit':         { Icon: Paintbrush,  bg: 'bg-pink-100',   color: 'text-pink-600'   },
  'tamplarie':      { Icon: Hammer,      bg: 'bg-orange-100', color: 'text-orange-600' },
  'constructii':    { Icon: Hammer,      bg: 'bg-orange-100', color: 'text-orange-600' },
  'gradinarit':     { Icon: TreePine,    bg: 'bg-green-100',  color: 'text-green-600'  },
  'mutari':         { Icon: Truck,       bg: 'bg-purple-100', color: 'text-purple-600' },
  'it':             { Icon: Cpu,         bg: 'bg-cyan-100',   color: 'text-cyan-600'   },
  'securitate':     { Icon: ShieldCheck, bg: 'bg-slate-100',  color: 'text-slate-600'  },
  'reparatii':      { Icon: Wrench,      bg: 'bg-red-100',    color: 'text-red-600'    },
}

function getCategoryConfig(category) {
  if (!category) return { Icon: HelpCircle, bg: 'bg-gray-100', color: 'text-gray-400' }
  const key = category.toLowerCase().trim()
  // exact match
  if (CATEGORY_MAP[key]) return CATEGORY_MAP[key]
  // partial match
  const found = Object.keys(CATEGORY_MAP).find(k => key.includes(k) || k.includes(key))
  return found ? CATEGORY_MAP[found] : { Icon: Wrench, bg: 'bg-gray-100', color: 'text-gray-400' }
}

/**
 * TaskPhoto
 *
 * Props:
 *   photos   – string[] | null   (array of URLs from Supabase storage)
 *   category – string | null     (category name, used for the placeholder icon)
 *   className – string           (applied to the root element, controls size/shape)
 */
export default function TaskPhoto({ photos, category, className = 'w-10 h-10' }) {
  const firstPhoto = Array.isArray(photos) && photos.length > 0 ? photos[0] : null

  if (firstPhoto) {
    return (
      <img
        src={firstPhoto}
        alt={category ?? 'task'}
        className={`${className} object-cover rounded-lg`}
        onError={(e) => {
          // fallback to placeholder on broken URL
          e.currentTarget.style.display = 'none'
          e.currentTarget.nextSibling?.style.removeProperty('display')
        }}
      />
    )
  }

  const { Icon, bg, color } = getCategoryConfig(category)

  return (
    <div className={`${className} ${bg} rounded-lg flex items-center justify-center flex-shrink-0`}>
      <Icon className={`w-1/2 h-1/2 ${color}`} />
    </div>
  )
}