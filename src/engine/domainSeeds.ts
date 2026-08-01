// src/engine/domainSeeds.ts
// Ontologie initiale des graines de domaines en Français (System Seeds)

import { StudyDomain } from '../types';

export const SYSTEM_DOMAIN_SEEDS: StudyDomain[] = [
  {
    id: 'tech',
    name: 'Tech & Systèmes',
    category: 'STEM',
    color: '#3B82F6',
    icon: '💻',
    isSystem: true,
    archived: false,
    hoursSpent: 0,
    level: 1,
    currentTier: 'Novice',
    tierProgressPct: 0,
    hoursRemainingInTier: 20,
    keywords: ['tech', 'dev', 'code', 'arch', 'web', 'logiciel', 'info', 'python', 'js', 'react']
  },
  {
    id: 'aero',
    name: 'Ingénierie & Physique',
    category: 'STEM',
    color: '#8B5CF6',
    icon: '⚙️',
    isSystem: true,
    archived: false,
    hoursSpent: 0,
    level: 1,
    currentTier: 'Novice',
    tierProgressPct: 0,
    hoursRemainingInTier: 20,
    keywords: ['physique', 'mecanique', 'fusée', 'aero', 'propulsion', 'elec', 'matériaux']
  },
  {
    id: 'science',
    name: 'Sciences & Recherche',
    category: 'STEM',
    color: '#06B6D4',
    icon: '🔬',
    isSystem: true,
    archived: false,
    hoursSpent: 0,
    level: 1,
    currentTier: 'Novice',
    tierProgressPct: 0,
    hoursRemainingInTier: 20,
    keywords: ['science', 'recherche', 'etude', 'labo', 'chimie', 'bio', 'math']
  },
  {
    id: 'agri',
    name: 'Agronomie & Botanique',
    category: 'STEM',
    color: '#10B981',
    icon: '🌿',
    isSystem: true,
    archived: false,
    hoursSpent: 0,
    level: 1,
    currentTier: 'Novice',
    tierProgressPct: 0,
    hoursRemainingInTier: 20,
    keywords: ['agri', 'botanique', 'potager', 'plante', 'terre', 'ecologie']
  },
  {
    id: 'finance',
    name: 'Finance & Économie',
    category: 'Humanities',
    color: '#F59E0B',
    icon: '💼',
    isSystem: true,
    archived: false,
    hoursSpent: 0,
    level: 1,
    currentTier: 'Novice',
    tierProgressPct: 0,
    hoursRemainingInTier: 20,
    keywords: ['finance', 'budget', 'economie', 'levee', 'bourse', 'compta', 'gestion']
  },
  {
    id: 'hum',
    name: 'Lettres & Philosophie',
    category: 'Humanities',
    color: '#EC4899',
    icon: '📖',
    isSystem: true,
    archived: false,
    hoursSpent: 0,
    level: 1,
    currentTier: 'Novice',
    tierProgressPct: 0,
    hoursRemainingInTier: 20,
    keywords: ['philo', 'histoire', 'droit', 'lettres', 'litterature', 'socio']
  },
  {
    id: 'art',
    name: 'Arts & Création',
    category: 'Arts',
    color: '#D946EF',
    icon: '🎨',
    isSystem: true,
    archived: false,
    hoursSpent: 0,
    level: 1,
    currentTier: 'Novice',
    tierProgressPct: 0,
    hoursRemainingInTier: 20,
    keywords: ['art', 'design', 'crea', 'musique', 'dessin', 'ui', 'ux']
  },
  {
    id: 'health',
    name: 'Santé & Performance',
    category: 'Physical',
    color: '#EF4444',
    icon: '🧠',
    isSystem: true,
    archived: false,
    hoursSpent: 0,
    level: 1,
    currentTier: 'Novice',
    tierProgressPct: 0,
    hoursRemainingInTier: 20,
    keywords: ['sante', 'sport', 'muscu', 'nutrition', 'sommeil', 'recup']
  },
  {
    id: 'logistics',
    name: 'Organisation & Logistique',
    category: 'Craft',
    color: '#14B8A6',
    icon: '📋',
    isSystem: true,
    archived: false,
    hoursSpent: 0,
    level: 1,
    currentTier: 'Novice',
    tierProgressPct: 0,
    hoursRemainingInTier: 20,
    keywords: ['orga', 'logistique', 'planification', 'taches', 'admin']
  }
];

/**
 * Fusion Saine de Réhydratation (Seed System vs User Data)
 * SeedSystem (+) UserData(hoursSpent, level, progress)
 */
export function mergeDomainOntology(existingDomains?: Record<string, StudyDomain> | StudyDomain[]): Record<string, StudyDomain> {
  const result: Record<string, StudyDomain> = {};

  // 1. Initialiser avec toutes les graines système du code source
  SYSTEM_DOMAIN_SEEDS.forEach(seed => {
    result[seed.id] = { ...seed };
  });

  if (!existingDomains) return result;

  const existingArray = Array.isArray(existingDomains) ? existingDomains : Object.values(existingDomains);

  // 2. Fusionner les données utilisateur par identifiant
  existingArray.forEach(userDomain => {
    if (!userDomain || !userDomain.id) return;

    if (result[userDomain.id]) {
      // Domaine Système : préserver les métadonnées système (libellé, icône, couleur, keywords)
      // tout en conservant l'expérience accumulée par l'utilisateur
      result[userDomain.id] = {
        ...result[userDomain.id],
        hoursSpent: userDomain.hoursSpent ?? result[userDomain.id].hoursSpent,
        level: userDomain.level ?? result[userDomain.id].level,
        currentTier: userDomain.currentTier ?? result[userDomain.id].currentTier,
        tierProgressPct: userDomain.tierProgressPct ?? result[userDomain.id].tierProgressPct,
        hoursRemainingInTier: userDomain.hoursRemainingInTier ?? result[userDomain.id].hoursRemainingInTier,
        archived: Boolean(userDomain.archived)
      };
    } else {
      // Domaine Personnalisé créé par l'utilisateur (isSystem: false) : conserver tel quel
      result[userDomain.id] = {
        ...userDomain,
        category: userDomain.category || 'Custom',
        isSystem: false,
        archived: Boolean(userDomain.archived)
      };
    }
  });

  return result;
}
