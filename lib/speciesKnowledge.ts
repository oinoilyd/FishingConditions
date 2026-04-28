export type Season = 'spring' | 'summer' | 'fall' | 'winter'

export interface DepthRange {
  min: number
  max: number
  note: string
}

export interface SeasonProfile {
  waterTempRange: { min: number; max: number }
  depth: DepthRange
  structure: string[]
  behavior: string
  bait: string[]
  retrieve: string
  pressureResponse: {
    falling: string
    stable: string
    rising: string
  }
  timeOfDay: {
    dawn: string
    midday: string
    dusk: string
    night: string
  }
}

export interface SpeciesProfile {
  name: string
  optimalTempRange: { min: number; max: number }
  seasons: Record<Season, SeasonProfile>
}

function getSeason(month: number): Season {
  if (month >= 3 && month <= 5) return 'spring'
  if (month >= 6 && month <= 8) return 'summer'
  if (month >= 9 && month <= 11) return 'fall'
  return 'winter'
}

export function getCurrentSeason(): Season {
  return getSeason(new Date().getMonth() + 1)
}

export const SPECIES_PROFILES: Record<string, SpeciesProfile> = {
  'largemouth-bass': {
    name: 'Largemouth Bass',
    optimalTempRange: { min: 65, max: 75 },
    seasons: {
      spring: {
        waterTempRange: { min: 48, max: 68 },
        depth: { min: 2, max: 15, note: 'Shallower as temps rise toward spawn; males guard beds in 2-6ft, pre-spawn females 8-15ft' },
        structure: ['spawning flats', 'secondary points', 'chunk rock banks', 'shallow brush piles', 'dock edges'],
        behavior: 'Aggressive pre-spawn feeding in 55-65°F. Spawning at 63-68°F in 2-6ft on hard bottom. Post-spawn females suspend or move deep.',
        bait: ['Texas-rigged Senko', 'squarebill crankbait', 'spinnerbait', 'swimbait', 'lipless crankbait'],
        retrieve: 'Slow and methodical near beds; faster reaction baits on pre-spawn points',
        pressureResponse: {
          falling: 'Highly active, move shallow aggressively',
          stable: 'Moderate activity, work structure thoroughly',
          rising: 'Sluggish post-front, finesse tactics near bottom'
        },
        timeOfDay: {
          dawn: 'Most active — shallow flats and points',
          midday: 'Move slightly deeper or under cover',
          dusk: 'Second feeding window, back to shallows',
          night: 'Moderate activity near shallow cover'
        }
      },
      summer: {
        waterTempRange: { min: 72, max: 90 },
        depth: { min: 8, max: 25, note: 'Deep structure during heat of day; shallow morning and evening only' },
        structure: ['deep brush piles', 'ledges', 'humps', 'submerged timber', 'main lake points', 'thermocline edges'],
        behavior: 'Heat-stressed midday, retreating to deep structure or heavy shade. Dawn/dusk windows are critical. Thermocline forces fish to specific depth bands.',
        bait: ['deep-diving crankbait', 'Carolina rig', 'football jig', 'dropshot', 'topwater at dawn/dusk'],
        retrieve: 'Slow and deep midday; aggressive topwater and swimbaits early and late',
        pressureResponse: {
          falling: 'Triggers feeding even midday',
          stable: 'Stick to dawn/dusk windows',
          rising: 'Very slow, go deep and finesse'
        },
        timeOfDay: {
          dawn: 'Prime — topwater on shallow flats',
          midday: 'Deep structure only, slow presentations',
          dusk: 'Prime — topwater and swimbaits',
          night: 'Very productive in summer heat, topwater'
        }
      },
      fall: {
        waterTempRange: { min: 50, max: 72 },
        depth: { min: 3, max: 15, note: 'Following shad to shallows as temps cool; most aggressive feeding of the year' },
        structure: ['main lake flats', 'creek channels', 'bluff walls', 'shallow points', 'rip-rap'],
        behavior: 'Fall turnover triggers aggressive feeding. Bass follow shad schools to shallows. One of the best feeding periods of the year as fish bulk up for winter.',
        bait: ['lipless crankbait', 'spinnerbait', 'swimbait', 'jerkbait', 'topwater popper'],
        retrieve: 'Fast and aggressive — match shad movement',
        pressureResponse: {
          falling: 'Exceptional — falling pressure + falling temps = feeding frenzy',
          stable: 'Good consistent action',
          rising: 'Slows but still catchable on fast baits'
        },
        timeOfDay: {
          dawn: 'Good — shad movements near surface',
          midday: 'Often excellent in fall unlike summer',
          dusk: 'Prime feeding window',
          night: 'Less productive than summer'
        }
      },
      winter: {
        waterTempRange: { min: 33, max: 52 },
        depth: { min: 15, max: 40, note: 'Deepest structure available; inactive and schooled tight' },
        structure: ['deep channel bends', 'main lake humps', 'deep brush piles', 'bluff ends'],
        behavior: 'Extremely lethargic below 50°F. Metabolism nearly stopped below 40°F. Small, slow presentations near bottom. Fish are schooled but barely moving.',
        bait: ['dropshot', 'blade bait', 'hair jig', 'small swimbait', 'finesse jig'],
        retrieve: 'Dead slow — barely move the bait. Long pauses are key.',
        pressureResponse: {
          falling: 'Mild improvement in activity',
          stable: 'Consistent slow bite',
          rising: 'Very slow, fish tight to bottom'
        },
        timeOfDay: {
          dawn: 'Coldest water temp — least active',
          midday: 'Best window as sun warms water slightly',
          dusk: 'Decent if sunny day warmed surface',
          night: 'Avoid in winter'
        }
      }
    }
  },

  'smallmouth-bass': {
    name: 'Smallmouth Bass',
    optimalTempRange: { min: 60, max: 72 },
    seasons: {
      spring: {
        waterTempRange: { min: 48, max: 65 },
        depth: { min: 4, max: 20, note: 'Pre-spawn on gravel points 10-20ft; spawning on gravel/rock in 4-12ft' },
        structure: ['gravel points', 'rock flats', 'gravel humps', 'main lake points', 'chunk rock'],
        behavior: 'Smallmouth spawn earlier than largemouth, prefer gravel and rock over sand. Highly aggressive pre-spawn. Beds visible in clear water 4-12ft.',
        bait: ['tube jig', 'dropshot', 'ned rig', 'jerkbait', 'small swimbait'],
        retrieve: 'Slow on gravel bottom; jerkbait pauses near structure',
        pressureResponse: {
          falling: 'Very aggressive, go shallower',
          stable: 'Work gravel points methodically',
          rising: 'Move deeper, finesse presentations'
        },
        timeOfDay: {
          dawn: 'Prime — active on shallow gravel',
          midday: 'Good in spring cooler temps',
          dusk: 'Strong second feeding window',
          night: 'Moderate'
        }
      },
      summer: {
        waterTempRange: { min: 65, max: 80 },
        depth: { min: 10, max: 30, note: 'Deep rock structure in rivers and lakes; current breaks in rivers' },
        structure: ['deep rock piles', 'current breaks', 'mid-lake humps', 'rock ledges', 'river eddies'],
        behavior: 'Relate strongly to current and oxygen. In rivers, stack behind boulders and in eddies. In lakes, suspend over deep rock humps near thermocline.',
        bait: ['ned rig', 'dropshot', 'tube', 'inline spinner', 'topwater at dawn'],
        retrieve: 'Natural drift in current; slow methodical on lake structure',
        pressureResponse: {
          falling: 'Feed aggressively, move shallower',
          stable: 'Consistent but deep',
          rising: 'Post-front tough, go very finesse'
        },
        timeOfDay: {
          dawn: 'Topwater on rocky shorelines',
          midday: 'Deep and slow',
          dusk: 'Active again near surface',
          night: 'Good in rivers near lights'
        }
      },
      fall: {
        waterTempRange: { min: 50, max: 68 },
        depth: { min: 5, max: 20, note: 'Following crayfish and baitfish; aggressive and widespread' },
        structure: ['rocky points', 'gravel flats', 'rip-rap', 'boulder fields'],
        behavior: 'Fall is prime smallmouth season. Highly aggressive chasing crayfish and gobies. Will chase fast presentations. Some of the best fishing of the year.',
        bait: ['jerkbait', 'swimbait', 'tube', 'crankbait', 'blade bait'],
        retrieve: 'Fast and aggressive, match baitfish',
        pressureResponse: {
          falling: 'Exceptional bite',
          stable: 'Strong consistent action',
          rising: 'Slows but still good'
        },
        timeOfDay: {
          dawn: 'Excellent',
          midday: 'Often great in fall',
          dusk: 'Prime',
          night: 'Good near structure'
        }
      },
      winter: {
        waterTempRange: { min: 33, max: 50 },
        depth: { min: 20, max: 45, note: 'Deepest available structure, tight schools' },
        structure: ['main lake rock piles', 'deep channel edges', 'river holes'],
        behavior: 'Schooled deep and lethargic. Slower metabolism than largemouth. Blade baits and small jigs near bottom.',
        bait: ['blade bait', 'small tube', 'dropshot', 'finesse jig'],
        retrieve: 'Extremely slow, lift-and-drop near bottom',
        pressureResponse: {
          falling: 'Slight improvement',
          stable: 'Slow consistent',
          rising: 'Very slow'
        },
        timeOfDay: {
          dawn: 'Least active',
          midday: 'Best window',
          dusk: 'Decent',
          night: 'Avoid'
        }
      }
    }
  },

  'walleye': {
    name: 'Walleye',
    optimalTempRange: { min: 55, max: 68 },
    seasons: {
      spring: {
        waterTempRange: { min: 38, max: 58 },
        depth: { min: 2, max: 12, note: 'Spawn in 2-6ft on gravel/rock at 42-50°F; post-spawn suspend 6-12ft' },
        structure: ['gravel reefs', 'rocky shorelines', 'river mouths', 'points near spawning reefs'],
        behavior: 'Walleye spawn early — first fish of spring. Rocky reefs and river tributaries at night. Post-spawn females recover in 6-15ft. One of the best times to fish.',
        bait: ['jig and minnow', 'bottom bouncer with crawler', 'jerkbait', 'lindy rig'],
        retrieve: 'Slow drag on bottom; jig hops near structure',
        pressureResponse: {
          falling: 'Very active, especially at night',
          stable: 'Good night bite',
          rising: 'Slower daytime, better after dark'
        },
        timeOfDay: {
          dawn: 'Excellent — transitioning from night feed',
          midday: 'Deeper and slow',
          dusk: 'Excellent — moving shallow',
          night: 'Prime — walleye are nocturnal hunters'
        }
      },
      summer: {
        waterTempRange: { min: 60, max: 75 },
        depth: { min: 15, max: 35, note: 'Deep structure during day; move shallow at night to feed on flats' },
        structure: ['deep rock humps', 'mid-lake reefs', 'thermocline edges', 'weed edges at night'],
        behavior: 'Light-sensitive — avoid bright conditions. Daytime deep, nighttime shallow. Weed edges and points at low light. Trolling covers water effectively.',
        bait: ['nightcrawler harness', 'deep-diving crankbait', 'bottom bouncer', 'live minnow on jig'],
        retrieve: 'Slow troll at 1.2-1.8 mph; vertical jig on structure',
        pressureResponse: {
          falling: 'More active than normal even in summer',
          stable: 'Night bite only in summer',
          rising: 'Tough — go very deep or wait for dark'
        },
        timeOfDay: {
          dawn: 'Prime — last hour of night feeding',
          midday: 'Very slow, deep structure only',
          dusk: 'Prime — begin moving shallow',
          night: 'Best bite of the day'
        }
      },
      fall: {
        waterTempRange: { min: 48, max: 62 },
        depth: { min: 8, max: 25, note: 'More active through daylight hours as temps cool' },
        structure: ['main lake points', 'rock piles', 'weed edges', 'transition areas'],
        behavior: 'Walleye become more catchable during daylight in fall. Feeding heavily before winter. One of the best all-day bites of the year.',
        bait: ['jig and minnow', 'jerkbait', 'crankbait', 'bottom bouncer'],
        retrieve: 'More aggressive than summer — cover water',
        pressureResponse: {
          falling: 'Excellent all-day bite',
          stable: 'Good consistent action',
          rising: 'Slows but still catchable'
        },
        timeOfDay: {
          dawn: 'Prime',
          midday: 'Good unlike summer',
          dusk: 'Prime',
          night: 'Still excellent'
        }
      },
      winter: {
        waterTempRange: { min: 33, max: 48 },
        depth: { min: 20, max: 40, note: 'Deep basin areas; ice fishing on soft bottoms and deep structure' },
        structure: ['deep basins', 'main lake humps', 'deep weed edges'],
        behavior: 'Active through winter unlike bass — walleye feed year-round. Ice fishing productive on small jigs tipped with minnow or waxworm.',
        bait: ['small jig with minnow', 'blade bait', 'jigging rap', 'live shiner'],
        retrieve: 'Subtle lifts and drops; deadstick with live minnow',
        pressureResponse: {
          falling: 'Good — more active than normal',
          stable: 'Consistent winter bite',
          rising: 'Slower'
        },
        timeOfDay: {
          dawn: 'Good',
          midday: 'Moderate',
          dusk: 'Prime',
          night: 'Prime'
        }
      }
    }
  },

  'pike': {
    name: 'Northern Pike / Muskie',
    optimalTempRange: { min: 55, max: 68 },
    seasons: {
      spring: {
        waterTempRange: { min: 38, max: 58 },
        depth: { min: 1, max: 8, note: 'Extremely shallow post-ice; spawning in weedy bays 1-4ft' },
        structure: ['shallow weedy bays', 'flooded vegetation', 'warm shallow coves', 'marsh edges'],
        behavior: 'First fish active after ice-out. Spawn in flooded vegetation at 38-48°F. Post-spawn pike are very catchable in shallow weeds.',
        bait: ['large spinnerbait', 'sucker on tip-up', 'large jerkbait', 'inline spinner'],
        retrieve: 'Slow through shallow weeds; erratic jerkbait pauses',
        pressureResponse: {
          falling: 'Very aggressive',
          stable: 'Good shallow bite',
          rising: 'Moves slightly deeper'
        },
        timeOfDay: {
          dawn: 'Active in shallows',
          midday: 'Good in spring cool temps',
          dusk: 'Prime feeding',
          night: 'Moderate'
        }
      },
      summer: {
        waterTempRange: { min: 62, max: 78 },
        depth: { min: 6, max: 20, note: 'Deep weed edges and points during heat; shallower at dawn/dusk' },
        structure: ['deep weed edges', 'main lake points', 'cabbage weed beds', 'suspended over deep basins'],
        behavior: 'Heat-stressed above 75°F. Move to deep weed edges and cooler water. Most active early morning. Muskies more active than pike in warm water.',
        bait: ['large glide bait', 'bucktail spinner', 'large swimbait', 'topwater over weeds at dawn'],
        retrieve: 'Figure-eight at boat essential for muskie; steady medium retrieve for pike',
        pressureResponse: {
          falling: 'Triggers aggressive feeding',
          stable: 'Dawn/dusk only in summer',
          rising: 'Very slow midday'
        },
        timeOfDay: {
          dawn: 'Best shot in summer',
          midday: 'Very slow in heat',
          dusk: 'Good second window',
          night: 'Productive for large pike'
        }
      },
      fall: {
        waterTempRange: { min: 48, max: 65 },
        depth: { min: 4, max: 18, note: 'Following baitfish, active throughout water column' },
        structure: ['weed edges', 'points', 'transition areas', 'open water near baitfish schools'],
        behavior: 'Fall is prime muskie season. Both pike and muskie feed heavily before winter. Big baits produce big fish. Follow cisco and shad schools.',
        bait: ['large glide bait', 'big jerkbait', 'swimbaits 8-12in', 'large bucktail'],
        retrieve: 'Aggressive and varied — change speeds and pauses',
        pressureResponse: {
          falling: 'Exceptional — best muskie bite of the year',
          stable: 'Very good',
          rising: 'Still active unlike other species'
        },
        timeOfDay: {
          dawn: 'Good',
          midday: 'Often excellent in fall',
          dusk: 'Prime',
          night: 'Very productive for trophy fish'
        }
      },
      winter: {
        waterTempRange: { min: 33, max: 48 },
        depth: { min: 15, max: 35, note: 'Deep basins near soft bottom; ice fishing productive' },
        structure: ['deep basins', 'main lake humps', 'deep weed remnants'],
        behavior: 'Slower but still feeding. Large sucker presentations under the ice or large slow-moving lures open water.',
        bait: ['large sucker under tip-up', 'large blade bait', 'big jig with sucker meat'],
        retrieve: 'Very slow with long pauses',
        pressureResponse: {
          falling: 'More active',
          stable: 'Slow consistent',
          rising: 'Very slow'
        },
        timeOfDay: {
          dawn: 'Moderate',
          midday: 'Best window',
          dusk: 'Good',
          night: 'Active'
        }
      }
    }
  },

  'trout': {
    name: 'Trout (Brown / Rainbow)',
    optimalTempRange: { min: 52, max: 64 },
    seasons: {
      spring: {
        waterTempRange: { min: 40, max: 60 },
        depth: { min: 1, max: 10, note: 'Shallow and active — ideal trout temperatures' },
        structure: ['riffle-pool transitions', 'undercut banks', 'cold tributaries', 'seams in current'],
        behavior: 'Prime trout season. Ideal temperatures trigger aggressive feeding. Rainbow trout spawn in spring, brown trout in fall. Active throughout the day.',
        bait: ['small crankbait', 'inline spinner', 'worm under float', 'minnow', 'soft plastic'],
        retrieve: 'Drift naturally in current; slow retrieve in lakes',
        pressureResponse: {
          falling: 'Very active',
          stable: 'Consistent all-day bite',
          rising: 'Slightly slower'
        },
        timeOfDay: {
          dawn: 'Prime',
          midday: 'Good in spring',
          dusk: 'Prime',
          night: 'Brown trout active at night'
        }
      },
      summer: {
        waterTempRange: { min: 55, max: 68 },
        depth: { min: 4, max: 20, note: 'Seeking cold water — springs, deep pools, cold tributaries' },
        structure: ['deep cold pools', 'spring holes', 'cold tributary mouths', 'shaded deep runs'],
        behavior: 'Thermal stress above 68°F. Seek coldest available water. In lakes, stay near thermocline. In streams, concentrate in deep cold pools and near springs.',
        bait: ['small jig', 'worm', 'small spoon', 'minnow near cold springs'],
        retrieve: 'Slow and deep near cold water sources',
        pressureResponse: {
          falling: 'More active than normal',
          stable: 'Early/late only in summer',
          rising: 'Very slow in warm water'
        },
        timeOfDay: {
          dawn: 'Best window before water warms',
          midday: 'Avoid in warm summer',
          dusk: 'Good second window',
          night: 'Best in summer for brown trout'
        }
      },
      fall: {
        waterTempRange: { min: 45, max: 62 },
        depth: { min: 2, max: 15, note: 'Brown trout spawning run; active and aggressive' },
        structure: ['gravel spawning runs', 'pool tailouts', 'riffle edges', 'tributary mouths'],
        behavior: 'Brown trout spawn in fall — very aggressive near spawning areas. Cooler temps reactivate trout throughout water column. Excellent fishing.',
        bait: ['egg pattern', 'small jig', 'inline spinner', 'minnow near spawning areas'],
        retrieve: 'Natural drift near spawning areas',
        pressureResponse: {
          falling: 'Excellent',
          stable: 'Very good',
          rising: 'Good'
        },
        timeOfDay: {
          dawn: 'Prime',
          midday: 'Good in fall temps',
          dusk: 'Prime',
          night: 'Excellent for brown trout'
        }
      },
      winter: {
        waterTempRange: { min: 33, max: 48 },
        depth: { min: 4, max: 15, note: 'Deep slow pools in streams; suspended in lakes near thermocline' },
        structure: ['deep winter pools', 'slow deep runs', 'lake basin edges'],
        behavior: 'Slow but not dormant — trout feed year-round. Small slow presentations in deep pools. Midday sun warming water is key trigger.',
        bait: ['small egg', 'waxworm', 'small jig', 'tiny spoon'],
        retrieve: 'Dead slow natural drift',
        pressureResponse: {
          falling: 'Better than average',
          stable: 'Slow consistent',
          rising: 'Very slow'
        },
        timeOfDay: {
          dawn: 'Cold and slow',
          midday: 'Best as sun warms water',
          dusk: 'Decent',
          night: 'Slow in winter'
        }
      }
    }
  },

  'salmon': {
    name: 'Salmon',
    optimalTempRange: { min: 50, max: 60 },
    seasons: {
      spring: {
        waterTempRange: { min: 40, max: 58 },
        depth: { min: 20, max: 80, note: 'Offshore following baitfish and temperature breaks' },
        structure: ['temperature breaks', 'baitfish schools offshore', 'river plume edges'],
        behavior: 'Scattered offshore following alewife and smelt. Trolling covers water. Surface temp breaks hold fish.',
        bait: ['spoon', 'flasher and fly', 'stick bait', 'cut bait on downrigger'],
        retrieve: 'Troll at 2-3 mph on downriggers at 20-60ft',
        pressureResponse: {
          falling: 'Triggers feeding',
          stable: 'Consistent trolling bite',
          rising: 'Move deeper'
        },
        timeOfDay: {
          dawn: 'Prime — salmon near surface',
          midday: 'Deeper',
          dusk: 'Prime',
          night: 'Active near pier lights'
        }
      },
      summer: {
        waterTempRange: { min: 50, max: 62 },
        depth: { min: 40, max: 120, note: 'Following thermocline deep offshore' },
        structure: ['thermocline edges', 'offshore baitfish concentrations', 'temperature breaks'],
        behavior: 'Deep offshore following cold water and alewife. Downriggers essential. Find the 52-58°F water band.',
        bait: ['spoon on downrigger', 'flasher and fly', 'stick bait', 'body bait'],
        retrieve: 'Troll 1.5-2.5 mph at thermocline depth',
        pressureResponse: {
          falling: 'Move shallower, more active',
          stable: 'Target thermocline precisely',
          rising: 'Go deeper'
        },
        timeOfDay: {
          dawn: 'Shallower and active',
          midday: 'Deep and technical',
          dusk: 'Shallower again',
          night: 'Near surface in darkness'
        }
      },
      fall: {
        waterTempRange: { min: 45, max: 58 },
        depth: { min: 2, max: 30, note: 'Staging in rivers and near tributary mouths for spawn run' },
        structure: ['tributary mouths', 'river staging areas', 'nearshore in big lakes', 'piers and harbors'],
        behavior: 'Staging salmon near river mouths for spawn run. Most accessible of the year from shore. Aggressive and stacked.',
        bait: ['spawn sack', 'spoon', 'fly', 'large jig'],
        retrieve: 'Drift naturally in current; cast and retrieve near river mouths',
        pressureResponse: {
          falling: 'Triggers movement into rivers',
          stable: 'Good staging bite',
          rising: 'Fish hold in lake near mouth'
        },
        timeOfDay: {
          dawn: 'Fish moving into rivers',
          midday: 'Good in fall',
          dusk: 'Prime movement time',
          night: 'Salmon move upriver after dark'
        }
      },
      winter: {
        waterTempRange: { min: 33, max: 48 },
        depth: { min: 10, max: 60, note: 'Offshore or in rivers post-spawn' },
        structure: ['deep offshore water', 'river holes post-spawn'],
        behavior: 'Most Pacific salmon die post-spawn. Steelhead and Atlantic salmon continue. Limited winter fishery.',
        bait: ['spawn sack', 'small spoon', 'jig'],
        retrieve: 'Slow natural drift',
        pressureResponse: {
          falling: 'Slight improvement',
          stable: 'Slow',
          rising: 'Very slow'
        },
        timeOfDay: {
          dawn: 'Moderate',
          midday: 'Best',
          dusk: 'Good',
          night: 'Limited'
        }
      }
    }
  },

  'catfish': {
    name: 'Catfish',
    optimalTempRange: { min: 65, max: 80 },
    seasons: {
      spring: {
        waterTempRange: { min: 50, max: 68 },
        depth: { min: 5, max: 20, note: 'Moving shallower as temps rise; pre-spawn feeding' },
        structure: ['river bends', 'channel edges', 'submerged timber', 'deep holes near shallow flats'],
        behavior: 'Increasing activity as water warms. Pre-spawn feeding ramp-up. Channel cats most active around 60-68°F.',
        bait: ['cut shad', 'chicken liver', 'nightcrawler', 'stink bait', 'live bluegill'],
        retrieve: 'Bottom presentation — anchor or slip sinker rig',
        pressureResponse: {
          falling: 'Move shallower, more active',
          stable: 'Consistent bottom bite',
          rising: 'Slightly slower'
        },
        timeOfDay: {
          dawn: 'Active from overnight feed',
          midday: 'Slower',
          dusk: 'Begin feeding',
          night: 'Prime — catfish are nocturnal'
        }
      },
      summer: {
        waterTempRange: { min: 70, max: 85 },
        depth: { min: 8, max: 25, note: 'Deep holes and channel edges during day; shallows at night' },
        structure: ['main channel holes', 'tail of deep pools', 'submerged structure', 'dam tailwaters'],
        behavior: 'Peak catfish season. Most active at night on shallow feeding flats. Flatheads dominate at night with live bait. Blue cats in current below dams.',
        bait: ['live bluegill for flathead', 'cut shad for blue cat', 'punch bait for channel cat'],
        retrieve: 'Stationary bottom fishing; drift rigs in current',
        pressureResponse: {
          falling: 'Very active after storms',
          stable: 'Night bite is consistent',
          rising: 'Slower but still feedable at night'
        },
        timeOfDay: {
          dawn: 'Good — end of night feed',
          midday: 'Very slow',
          dusk: 'Begin moving to feeding areas',
          night: 'Prime — best catfish time of day'
        }
      },
      fall: {
        waterTempRange: { min: 55, max: 70 },
        depth: { min: 10, max: 30, note: 'Staging in deeper holes as temps drop' },
        structure: ['deep river holes', 'main channel edges', 'confluence areas'],
        behavior: 'Feeding heavily before winter. More active during daylight than summer. Good fall bite especially early in the season.',
        bait: ['cut shad', 'live bait', 'nightcrawler', 'prepared stink bait'],
        retrieve: 'Bottom presentations near structure',
        pressureResponse: {
          falling: 'Excellent',
          stable: 'Good',
          rising: 'Slower'
        },
        timeOfDay: {
          dawn: 'Good',
          midday: 'Better than summer',
          dusk: 'Prime',
          night: 'Prime'
        }
      },
      winter: {
        waterTempRange: { min: 33, max: 52 },
        depth: { min: 20, max: 50, note: 'Deepest available holes, very tight schools' },
        structure: ['deepest river holes', 'main channel depths', 'tailwaters below dams'],
        behavior: 'Lethargic and schooled deep. Tailwaters below dams stay warmer and hold active fish. Very slow presentations.',
        bait: ['cut shad', 'shrimp', 'small live bait'],
        retrieve: 'Stationary on bottom',
        pressureResponse: {
          falling: 'Slight improvement',
          stable: 'Slow',
          rising: 'Very slow'
        },
        timeOfDay: {
          dawn: 'Slow',
          midday: 'Best window',
          dusk: 'Moderate',
          night: 'Less nocturnal in winter'
        }
      }
    }
  },

  'panfish': {
    name: 'Panfish / Crappie / Bluegill',
    optimalTempRange: { min: 62, max: 75 },
    seasons: {
      spring: {
        waterTempRange: { min: 55, max: 72 },
        depth: { min: 1, max: 8, note: 'Spawning in shallows 2-6ft; most accessible of the year' },
        structure: ['shallow brush piles', 'dock pilings', 'submerged timber', 'weed edges', 'coves'],
        behavior: 'Spawning season is prime panfish time. Crappie spawn at 58-65°F, bluegill at 68-72°F. Stacked in shallows and very aggressive. Year\'s best bite.',
        bait: ['small jig 1/32-1/16oz', 'minnow under float', 'waxworm', 'small tube', 'curly tail grub'],
        retrieve: 'Slow bobber presentation or small jig with subtle hops',
        pressureResponse: {
          falling: 'Very active in shallows',
          stable: 'Excellent shallow bite',
          rising: 'Slightly off beds, still catchable'
        },
        timeOfDay: {
          dawn: 'Excellent',
          midday: 'Good during spawn',
          dusk: 'Excellent',
          night: 'Crappie very active around lights'
        }
      },
      summer: {
        waterTempRange: { min: 68, max: 82 },
        depth: { min: 6, max: 18, note: 'Suspending near brush and timber mid-depth' },
        structure: ['submerged timber', 'brush piles', 'dock shade', 'deep weed edges'],
        behavior: 'Move deeper and suspend near structure. Crappie stack on brush piles in 8-15ft. Bluegill near dock shade and weed edges.',
        bait: ['small tube jig', 'minnow', 'small blade bait', 'tiny crankbait'],
        retrieve: 'Slow presentation at correct depth; target suspended fish',
        pressureResponse: {
          falling: 'More active',
          stable: 'Target structure depth precisely',
          rising: 'Go deeper'
        },
        timeOfDay: {
          dawn: 'Shallower',
          midday: 'Deep brush, shade',
          dusk: 'Move shallower',
          night: 'Excellent crappie bite around lights'
        }
      },
      fall: {
        waterTempRange: { min: 52, max: 68 },
        depth: { min: 4, max: 15, note: 'Following baitfish, spreading out' },
        structure: ['main lake points', 'brush piles', 'creek channels', 'deeper flats'],
        behavior: 'Feeding actively before winter. Schools move around following baitfish. Good consistent bite throughout the day.',
        bait: ['small jig', 'minnow', 'small crankbait', 'tube'],
        retrieve: 'Moderate speed — match baitfish',
        pressureResponse: {
          falling: 'Excellent',
          stable: 'Good',
          rising: 'Slower'
        },
        timeOfDay: {
          dawn: 'Good',
          midday: 'Often good in fall',
          dusk: 'Prime',
          night: 'Good crappie bite'
        }
      },
      winter: {
        waterTempRange: { min: 33, max: 52 },
        depth: { min: 10, max: 25, note: 'Deep brush piles and timber, tight schools' },
        structure: ['deep brush piles', 'submerged timber', 'channel edges'],
        behavior: 'Schooled deep near structure. Ice fishing for bluegill and crappie can be excellent. Small slow presentations.',
        bait: ['waxworm on tiny jig', 'small minnow', 'euro larva', 'small spoon'],
        retrieve: 'Barely move — tiny lifts and drops',
        pressureResponse: {
          falling: 'Better',
          stable: 'Slow consistent',
          rising: 'Very slow'
        },
        timeOfDay: {
          dawn: 'Moderate',
          midday: 'Best',
          dusk: 'Good',
          night: 'Crappie active under ice'
        }
      }
    }
  },

  'general': {
    name: 'General (All Species)',
    optimalTempRange: { min: 55, max: 75 },
    seasons: {
      spring: {
        waterTempRange: { min: 45, max: 68 },
        depth: { min: 3, max: 15, note: 'Most species moving shallow as water warms' },
        structure: ['shallow flats', 'points', 'spawning areas', 'warming coves'],
        behavior: 'Most gamefish species becoming active. Water temps rising toward optimal range. Shallow presentations increasingly productive.',
        bait: ['versatile presentations — spinnerbait, jig, crankbait'],
        retrieve: 'Moderate, adjust based on activity level',
        pressureResponse: {
          falling: 'Broadly positive across species',
          stable: 'Good consistent action',
          rising: 'Post-front toughens bite'
        },
        timeOfDay: {
          dawn: 'Prime across all species',
          midday: 'Decent in spring',
          dusk: 'Prime',
          night: 'Moderate'
        }
      },
      summer: {
        waterTempRange: { min: 68, max: 85 },
        depth: { min: 8, max: 25, note: 'Most species deep during heat, active dawn and dusk only' },
        structure: ['deep structure', 'shade', 'current', 'thermocline'],
        behavior: 'Heat limits activity midday. Dawn and dusk windows are critical. Find oxygen-rich water near current or thermocline.',
        bait: ['deep presentations midday', 'topwater dawn/dusk'],
        retrieve: 'Slow and deep midday; fast and aggressive early/late',
        pressureResponse: {
          falling: 'Triggers broader feeding activity',
          stable: 'Dawn/dusk windows only',
          rising: 'Very slow midday'
        },
        timeOfDay: {
          dawn: 'Prime',
          midday: 'Slow for most species',
          dusk: 'Prime',
          night: 'Good for nocturnal feeders'
        }
      },
      fall: {
        waterTempRange: { min: 48, max: 68 },
        depth: { min: 4, max: 20, note: 'Species-dependent but generally following baitfish' },
        structure: ['main lake structure', 'baitfish schools', 'points and transitions'],
        behavior: 'Fall is the best overall fishing season. Most species feeding aggressively before winter. Follows baitfish migrations.',
        bait: ['match baitfish — swimbaits, crankbaits, spinnerbaits'],
        retrieve: 'Generally faster and more aggressive than other seasons',
        pressureResponse: {
          falling: 'Exceptional across species',
          stable: 'Very good',
          rising: 'Still decent'
        },
        timeOfDay: {
          dawn: 'Excellent',
          midday: 'Often productive unlike summer',
          dusk: 'Excellent',
          night: 'Good for many species'
        }
      },
      winter: {
        waterTempRange: { min: 33, max: 48 },
        depth: { min: 15, max: 40, note: 'Most species deep and lethargic' },
        structure: ['deep main lake', 'channel edges', 'deepest available structure'],
        behavior: 'Most species slowed significantly. Small slow presentations near bottom. Midday sun warming water is the primary trigger.',
        bait: ['finesse presentations', 'small jigs', 'live bait'],
        retrieve: 'Very slow with long pauses',
        pressureResponse: {
          falling: 'Mild improvement',
          stable: 'Slow consistent',
          rising: 'Very slow'
        },
        timeOfDay: {
          dawn: 'Coldest — least active',
          midday: 'Best window',
          dusk: 'Decent',
          night: 'Avoid most species'
        }
      }
    }
  }
}

export function getSpeciesContext(speciesKey: string): string {
  const profile = SPECIES_PROFILES[speciesKey]
  if (!profile) return ''

  const season = getCurrentSeason()
  const seasonProfile = profile.seasons[season]
  const month = new Date().toLocaleString('en-US', { month: 'long' })

  return `
VERIFIED SPECIES BIOLOGY — ${profile.name.toUpperCase()} — ${season.toUpperCase()} (${month})
Optimal water temp: ${profile.optimalTempRange.min}-${profile.optimalTempRange.max}°F
Current season depth range: ${seasonProfile.depth.min}-${seasonProfile.depth.max}ft — ${seasonProfile.depth.note}
Key structure: ${seasonProfile.structure.join(', ')}
Seasonal behavior: ${seasonProfile.behavior}
Proven baits this season: ${seasonProfile.bait.join(', ')}
Retrieve style: ${seasonProfile.retrieve}
Pressure response — Falling: ${seasonProfile.pressureResponse.falling} | Stable: ${seasonProfile.pressureResponse.stable} | Rising: ${seasonProfile.pressureResponse.rising}
Time of day — Dawn: ${seasonProfile.timeOfDay.dawn} | Midday: ${seasonProfile.timeOfDay.midday} | Dusk: ${seasonProfile.timeOfDay.dusk} | Night: ${seasonProfile.timeOfDay.night}

IMPORTANT: Your depth, bait, and structure recommendations MUST align with the verified biology above. Do not recommend depths or tactics that contradict this data.`
}
