import { Award, Clock, Coins, Globe, Scale, Star } from 'lucide-react'
import type { LawyerVerdict } from '../../utils/compareAnalyzer'

/** Icon for a verdict badge ("cheapest", "most experienced"...). */
export default function BadgeIcon({ name, size = 14 }: { name: LawyerVerdict['badge']['iconName']; size?: number }) {
  switch (name) {
    case 'award':
      return <Award size={size} aria-hidden />
    case 'coins':
      return <Coins size={size} aria-hidden />
    case 'clock':
      return <Clock size={size} aria-hidden />
    case 'globe':
      return <Globe size={size} aria-hidden />
    case 'star':
      return <Star size={size} aria-hidden />
    default:
      return <Scale size={size} aria-hidden />
  }
}
