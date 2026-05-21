import { BANNED_TRADEMARKS } from './constants';
import { QueueItem, ComplianceResult, ComplianceViolation } from './types';
import {
  BANNED_STYLE_PHRASES,
  BANNED_FICTIONAL_NAMES,
  BANNED_CELEBRITIES,
  BANNED_ARTISTS,
  BANNED_MOVIE_FRANCHISES,
  BANNED_ANIME_SERIES,
  BANNED_GAME_FRANCHISES,
  BANNED_BRANDS,
  BANNED_NEWS_EVENTS,
  ALL_BANNED_TERMS,
  COMPLIANCE_REGEX_PATTERNS
} from './constants/compliance';

// =========================================
// MICROSTOCK COMPLIANCE FILTER SYSTEM
// For Adobe Stock, Shutterstock, Freepik, iStock, Vecteezy, Canva, Dreamstime
// =========================================

/**
 * TASK 1: Metadata Intelligence System - Analyze visual intent
 * Returns structured analysis of objects, scene flow, and commercial concepts
 */
export interface MetadataIntentAnalysis {
  objects: string[];        // Main objects detected in asset
  sceneFlow: string[];      // Scene understanding / scenario
  commercialConcept: string[]; // Commercial intent concepts
}

export function analyzeMetadataIntent(
  visualDescription: string,
  detectedObjects?: string[]
): MetadataIntentAnalysis {
  const lowerDesc = (visualDescription || '').toLowerCase();
  
  const result: MetadataIntentAnalysis = {
    objects: [],
    sceneFlow: [],
    commercialConcept: []
  };

  // Extract objects from visual description or detected objects
  if (detectedObjects && detectedObjects.length > 0) {
    result.objects = detectedObjects.filter(obj => obj.trim().length > 0);
  } else {
    // Fallback: extract noun-like words from description
    const objectCandidates = lowerDesc.match(/\b[a-z]{3,15}\b/g) || [];
    result.objects = objectCandidates.slice(0, 10);
  }

  // Detect scene flow / scenario
  const sceneIndicators: Record<string, string[]> = {
    easter: ['easter', 'bunny', 'rabbit', 'egg', 'basket', 'spring'],
    spring: ['spring', 'flower', 'bloom', 'garden', 'fresh'],
    christmas: ['christmas', 'santa', 'tree', 'ornament', 'snow', 'holiday'],
    halloween: ['halloween', 'pumpkin', 'ghost', 'spooky', 'costume'],
    birthday: ['birthday', 'cake', 'candle', 'party', 'celebration'],
    wedding: ['wedding', 'bride', 'groom', 'ring', 'ceremony'],
    business: ['business', 'office', 'meeting', 'corporate', 'professional'],
    food: ['food', 'meal', 'dish', 'ingredient', 'cooking', 'recipe'],
    nature: ['nature', 'landscape', 'outdoor', 'scenic', 'environment'],
    technology: ['technology', 'digital', 'device', 'screen', 'interface']
  };

  Object.entries(sceneIndicators).forEach(([scene, keywords]) => {
    if (keywords.some(kw => lowerDesc.includes(kw))) {
      result.sceneFlow.push(scene);
    }
  });

  // Add generic scene descriptors based on composition
  if (lowerDesc.includes('white background') || lowerDesc.includes('isolated')) {
    result.sceneFlow.push('studio setup');
  }
  if (lowerDesc.includes('flat lay') || lowerDesc.includes('top view')) {
    result.sceneFlow.push('overhead composition');
  }
  if (lowerDesc.includes('lifestyle') || lowerDesc.includes('people')) {
    result.sceneFlow.push('lifestyle scenario');
  }

  // Detect commercial concepts
  const commercialIndicators: Record<string, string[]> = {
    'copy space': ['copy space', 'empty space', 'text space', 'negative space'],
    'isolated': ['isolated', 'cut out', 'white background', 'transparent'],
    'background': ['background', 'backdrop', 'wallpaper', 'pattern'],
    'template': ['template', 'layout', 'design element', 'mockup'],
    'advertising': ['advertising', 'commercial', 'marketing', 'promotional'],
    'banner': ['banner', 'header', 'web banner', 'social media'],
    'flat lay': ['flat lay', 'top view', 'overhead', 'knolling'],
    'minimal': ['minimal', 'minimalist', 'clean', 'simple'],
    'conceptual': ['concept', 'symbolic', 'metaphor', 'abstract idea']
  };

  Object.entries(commercialIndicators).forEach(([concept, keywords]) => {
    if (keywords.some(kw => lowerDesc.includes(kw))) {
      result.commercialConcept.push(concept);
    }
  });

  // Ensure at least some commercial concepts for buyer intent
  if (result.commercialConcept.length === 0) {
    result.commercialConcept.push('commercial use');
  }

  return result;
}

/**
 * Scan text for compliance violations across all banned categories
 */
export function scanComplianceViolations(
  text: string,
  field: 'title' | 'description' | 'keywords' | 'prompt' = 'title'
): ComplianceViolation[] {
  if (!text) return [];

  const violations: ComplianceViolation[] = [];
  const lowerText = text.toLowerCase();

  // Check style reference phrases
  BANNED_STYLE_PHRASES.forEach(phrase => {
    if (lowerText.includes(phrase)) {
      violations.push({
        type: 'style',
        term: phrase,
        field,
        severity: 'high'
      });
    }
  });

  // Check regex patterns for variations
  Object.entries(COMPLIANCE_REGEX_PATTERNS).forEach(([patternName, regex]) => {
    const matches = lowerText.match(regex);
    if (matches) {
      matches.forEach(match => {
        const trimmedMatch = match.trim();
        // Avoid duplicate violations
        if (!violations.some(v => v.term === trimmedMatch)) {
          let violationType: ComplianceViolation['type'] = 'brand';
          let severity: ComplianceViolation['severity'] = 'medium';

          if (patternName.includes('style')) {
            violationType = 'style';
            severity = 'high';
          } else if (patternName.includes('fictional')) {
            violationType = 'fictional';
            severity = 'high';
          } else if (patternName.includes('celebrity')) {
            violationType = 'celebrity';
            severity = 'high';
          } else if (patternName.includes('media')) {
            violationType = 'media';
            severity = 'high';
          } else if (patternName.includes('news')) {
            violationType = 'news';
            severity = 'medium';
          }

          violations.push({
            type: violationType,
            term: trimmedMatch,
            field,
            severity
          });
        }
      });
    }
  });

  // Check banned arrays with fuzzy lowercase comparison
  const checkBannedList = (
    list: string[],
    type: ComplianceViolation['type'],
    severity: ComplianceViolation['severity']
  ) => {
    list.forEach(term => {
      const termLower = term.toLowerCase();
      // Check for exact word boundary match or inclusion
      const wordBoundaryRegex = new RegExp(`\\b${termLower.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
      if (wordBoundaryRegex.test(lowerText) || lowerText.includes(termLower)) {
        if (!violations.some(v => v.term.toLowerCase() === termLower)) {
          violations.push({
            type,
            term,
            field,
            severity
          });
        }
      }
    });
  };

  checkBannedList(BANNED_FICTIONAL_NAMES, 'fictional', 'high');
  checkBannedList(BANNED_CELEBRITIES, 'celebrity', 'high');
  checkBannedList(BANNED_ARTISTS, 'artist', 'high');
  checkBannedList(BANNED_MOVIE_FRANCHISES, 'media', 'high');
  checkBannedList(BANNED_ANIME_SERIES, 'media', 'high');
  checkBannedList(BANNED_GAME_FRANCHISES, 'media', 'high');
  checkBannedList(BANNED_BRANDS, 'brand', 'high');
  checkBannedList(BANNED_NEWS_EVENTS, 'news', 'medium');

  return violations;
}

/**
 * Calculate compliance score based on violations found
 */
export function calculateComplianceScore(violations: ComplianceViolation[]): number {
  if (violations.length === 0) return 100;

  let score = 100;
  violations.forEach(violation => {
    switch (violation.severity) {
      case 'high':
        score -= 15;
        break;
      case 'medium':
        score -= 8;
        break;
      case 'low':
        score -= 3;
        break;
    }
  });

  return Math.max(0, score);
}

/**
 * Sanitize metadata by removing banned terms and phrases
 */
export function sanitizeComplianceMetadata(metadata: {
  title: string;
  description: string;
  keywords: string[];
}): {
  title: string;
  description: string;
  keywords: string[];
  warnings: string[];
} {
  const warnings: string[] = [];

  // Helper function to remove banned terms from text
  const cleanText = (text: string, fieldName: string): string => {
    let cleaned = text;
    const lowerCleaned = cleaned.toLowerCase();

    // Remove style phrases
    BANNED_STYLE_PHRASES.forEach(phrase => {
      const regex = new RegExp(`\\b${phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'gi');
      if (regex.test(cleaned)) {
        cleaned = cleaned.replace(regex, '');
        warnings.push(`Removed style phrase "${phrase}" from ${fieldName}`);
      }
    });

    // Apply regex pattern cleaning
    Object.entries(COMPLIANCE_REGEX_PATTERNS).forEach(([, regex]) => {
      const matches = cleaned.match(regex);
      if (matches) {
        matches.forEach(match => {
          const escapedMatch = match.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
          const removeRegex = new RegExp(escapedMatch, 'gi');
          cleaned = cleaned.replace(removeRegex, '');
        });
        if (matches.length > 0) {
          warnings.push(`Removed ${matches.length} banned pattern match(es) from ${fieldName}`);
        }
      }
    });

    // Remove banned terms from lists
    const allBannedTerms = [
      ...BANNED_FICTIONAL_NAMES,
      ...BANNED_CELEBRITIES,
      ...BANNED_ARTISTS,
      ...BANNED_MOVIE_FRANCHISES,
      ...BANNED_ANIME_SERIES,
      ...BANNED_GAME_FRANCHISES,
      ...BANNED_BRANDS
    ];

    allBannedTerms.forEach(term => {
      const termLower = term.toLowerCase();
      const wordBoundaryRegex = new RegExp(`\\b${termLower.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'gi');
      if (wordBoundaryRegex.test(cleaned)) {
        cleaned = cleaned.replace(wordBoundaryRegex, '');
        warnings.push(`Removed banned term "${term}" from ${fieldName}`);
      }
    });

    // Clean up extra spaces and punctuation issues
    cleaned = cleaned.replace(/\s+/g, ' ').trim();
    cleaned = cleaned.replace(/\s+[,.;:!?]/g, ',');
    cleaned = cleaned.replace(/^[,.;:!?]+|[,.;:!?]+$/g, '');

    return cleaned;
  };

  // Clean title
  let sanitizedTitle = cleanText(metadata.title || '', 'title');
  if (!sanitizedTitle) {
    sanitizedTitle = 'Commercial lifestyle image';
    warnings.push('Title was empty after sanitization, using generic fallback');
  }

  // Clean description
  let sanitizedDescription = cleanText(metadata.description || '', 'description');
  if (!sanitizedDescription) {
    sanitizedDescription = 'Professional commercial asset suitable for various design projects.';
    warnings.push('Description was empty after sanitization, using generic fallback');
  }

  // Clean keywords
  const sanitizedKeywords = metadata.keywords
    .map(kw => {
      let cleanedKw = kw;
      const lowerKw = cleanedKw.toLowerCase();

      // Check against all banned lists
      const allBannedTerms = [
        ...BANNED_FICTIONAL_NAMES,
        ...BANNED_CELEBRITIES,
        ...BANNED_ARTISTS,
        ...BANNED_MOVIE_FRANCHISES,
        ...BANNED_ANIME_SERIES,
        ...BANNED_GAME_FRANCHISES,
        ...BANNED_BRANDS,
        ...BANNED_STYLE_PHRASES
      ];

      allBannedTerms.forEach(term => {
        const termLower = term.toLowerCase();
        if (lowerKw === termLower || lowerKw.includes(termLower)) {
          cleanedKw = '';
          warnings.push(`Removed banned keyword "${term}"`);
        }
      });

      // Apply regex patterns
      Object.values(COMPLIANCE_REGEX_PATTERNS).forEach(regex => {
        if (regex.test(lowerKw)) {
          cleanedKw = '';
          warnings.push(`Removed keyword matching banned pattern: "${kw}"`);
        }
      });

      return cleanedKw.trim();
    })
    .filter(kw => kw.length > 0 && kw.length <= 50);

  // Remove duplicate keywords after sanitization
  const uniqueKeywords = Array.from(new Set(sanitizedKeywords.map(k => k.toLowerCase())))
    .map(lower => sanitizedKeywords.find(k => k.toLowerCase() === lower) || '')
    .filter(Boolean);

  return {
    title: sanitizedTitle,
    description: sanitizedDescription,
    keywords: uniqueKeywords,
    warnings
  };
}

/**
 * Full compliance check and sanitization pipeline
 */
export function enforceCompliance(metadata: {
  title: string;
  description: string;
  keywords: string[];
}, prompt?: string): {
  metadata: {
    title: string;
    description: string;
    keywords: string[];
  };
  complianceResult: ComplianceResult;
} {
  // Scan for violations
  const titleViolations = scanComplianceViolations(metadata.title, 'title');
  const descViolations = scanComplianceViolations(metadata.description, 'description');
  const keywordViolations = metadata.keywords.flatMap(kw =>
    scanComplianceViolations(kw, 'keywords')
  );
  const promptViolations = prompt ? scanComplianceViolations(prompt, 'prompt') : [];

  const allViolations = [...titleViolations, ...descViolations, ...keywordViolations, ...promptViolations];

  // Calculate compliance score
  const complianceScore = calculateComplianceScore(allViolations);

  // Generate warnings
  const warnings = allViolations.map(v =>
    `Detected ${v.type} reference: "${v.term}" in ${v.field}`
  );

  // Sanitize metadata
  const sanitized = sanitizeComplianceMetadata(metadata);

  // Add sanitization warnings
  warnings.push(...sanitized.warnings);

  return {
    metadata: {
      title: sanitized.title,
      description: sanitized.description,
      keywords: sanitized.keywords
    },
    complianceResult: {
      complianceScore,
      warnings,
      violationsFound: allViolations
    }
  };
}

/**
 * Generate compliance-safe AI prompt instructions
 */
export const COMPLIANCE_PROMPT_INSTRUCTIONS = `COMPLIANCE RULES - MANDATORY FOR MICROSTOCK ACCEPTANCE:
- Do not mention any brand names (Apple, Nike, BMW, Sony, etc.)
- Do not mention copyrighted artists or art styles (Van Gogh, Picasso, Disney, etc.)
- Do not mention fictional characters (Mickey Mouse, Batman, Naruto, Mario, etc.)
- Do not mention celebrities or public figures (Taylor Swift, Elon Musk, etc.)
- Do not generate style references ("in the style of", "inspired by", etc.)
- Do not imply real news events, elections, protests, or political content
- Generate fully generic commercial metadata that is safe for all microstock platforms
- Use descriptive, generic terms only (e.g., "athletic shoes" not "Nike")
- Focus on visual elements, colors, composition, and commercial concepts
- All output must pass Adobe Stock, Shutterstock, and Freepik compliance checks`;

// =========================================
// =========================================
// MICROSTOCK SEO UTILITIES - ENHANCED
// =========================================

// Commercial keywords with high buyer intent (priority order)
const COMMERCIAL_KEYWORDS = [
  'copy space',
  'background',
  'banner',
  'template',
  'flat lay',
  'top view',
  'commercial',
  'advertising',
  'mockup'
];

// Spam/low-value keywords blacklist for microstock 2026 - EXPANDED
const SPAM_KEYWORDS_BLACKLIST = [
  'food', 'delicious', 'aesthetic', 'tasty', 'yummy',
  'beautiful', 'awesome', 'cool', 'nice', 'amazing',
  'best quality', 'masterpiece', 'ultra hd',
  'tasteful', 'scrumptious', 'flavorful', 'savory',
  'delectable', 'appetizing', 'mouthwatering', 'delightful',
  'wonderful', 'gorgeous', 'stunning', 'breathtaking',
  'spectacular', 'incredible', 'fantastic', 'marvelous',
  'fabulous', 'terrific', 'excellent', 'superb',
  'outstanding', 'exceptional', 'remarkable', 'impressive',
  'magnificent', 'splendid', 'glorious', 'radiant',
  'dazzling', 'vibrant', 'lively', 'charming',
  'elegant', 'sophisticated', 'classy', 'stylish',
  'trendy', 'fashionable', 'chic',
  'perfect', 'flawless', 'impeccable', 'pristine',
  'high quality', 'premium', 'luxury', 'exclusive',
  'unique', 'special', 'rare', 'precious',
  'valuable', 'priceless', 'irreplaceable',
  'innovative', 'revolutionary', 'groundbreaking',
  'cutting-edge', 'state-of-the-art', 'advanced',
  'professional', 'creative', 'modern', 'contemporary',
  'minimal', 'clean', 'simple', 'basic',
  'generic', 'standard', 'common', 'ordinary',
  'typical', 'regular', 'normal', 'average',
  // Generic adjectives with low buyer intent - TASK 2 ENHANCED
  'adorable', 'bright', 'colorful', 'concept', 'holiday',
  'country', 'blooming', 'daylight', 'domestic', 'cute concept',
  'holiday mood', 'country style', 'artistic', 'dreamy',
  'magical', 'ethereal', 'mystical', 'romantic', 'nostalgic',
  'sentimental', 'emotional', 'dramatic', 'intense', 'powerful',
  'strong', 'weak', 'soft', 'hard', 'rough', 'smooth',
  'warm', 'cold', 'hot', 'fresh', 'old', 'new', 'young',
  'happy', 'sad', 'angry', 'calm', 'peaceful', 'quiet',
  'loud', 'busy', 'empty', 'full', 'rich', 'poor',
  'big', 'small', 'large', 'tiny', 'huge', 'massive',
  'little', 'great', 'good', 'bad', 'fine', 'okay',
  'lovely', 'pretty', 'handsome', 'ugly', 'plain',
  'fancy', 'simple', 'complex', 'easy', 'difficult'
];

// Weak adjective filter for single keyword mode - TASK 7 ENHANCED
const WEAK_ADJECTIVE_BLACKLIST = [
  'adorable', 'beautiful', 'bright', 'colorful', 'nice', 'amazing',
  'cute', 'lovely', 'pretty', 'gorgeous', 'stunning', 'wonderful',
  'fantastic', 'great', 'good', 'fine', 'excellent', 'superb',
  'awesome', 'cool', 'neat', 'tidy', 'clean', 'pure', 'simple',
  'basic', 'plain', 'fancy', 'elegant', 'classy', 'stylish',
  'trendy', 'modern', 'contemporary', 'traditional', 'classic',
  'vintage', 'retro', 'old', 'new', 'fresh', 'clean',
  'clear', 'bright', 'dark', 'light', 'heavy', 'soft',
  'hard', 'smooth', 'rough', 'gentle', 'kind', 'sweet',
  'warm', 'cozy', 'comfortable', 'pleasant', 'agreeable',
  'delightful', 'charming', 'appealing', 'attractive', 'alluring',
  'captivating', 'engaging', 'interesting', 'exciting', 'thrilling',
  'boring', 'dull', 'plain', 'ordinary', 'common', 'usual',
  'regular', 'standard', 'normal', 'typical', 'average',
  'general', 'universal', 'global', 'local', 'regional',
  'national', 'international', 'public', 'private', 'personal',
  'individual', 'single', 'double', 'triple', 'multiple',
  'various', 'several', 'many', 'few', 'some', 'any',
  'all', 'every', 'each', 'both', 'either', 'neither',
  'none', 'no', 'yes', 'maybe', 'perhaps', 'possibly',
  'probably', 'certainly', 'definitely', 'absolutely', 'completely',
  'totally', 'fully', 'partially', 'partly', 'mostly', 'mainly',
  'generally', 'specifically', 'particularly', 'especially', 'notably',
  'remarkably', 'significantly', 'considerably', 'substantially',
  'relatively', 'comparatively', 'approximately', 'roughly', 'about'
];

/**
 * TASK 1: Normalize keyword phrase - split repeated tokens, remove duplicated words, remove phrase looping
 */
export function normalizeKeywordPhrase(phrase: string): string[] {
  if (!phrase || typeof phrase !== 'string') return [];
  
  const normalized = phrase.toLowerCase().trim();
  
  // Split into individual words
  const words = normalized.split(/\s+/).filter(w => w.length > 0);
  
  if (words.length === 0) return [];
  
  // Detect and remove repeated word patterns (looping)
  // e.g., "rabbit flat lay rabbit top view flat lay" -> detect repetition
  const cleanWords: string[] = [];
  const seenWords = new Set<string>();
  
  for (const word of words) {
    // Skip if word was already seen in this phrase (removes looping)
    if (seenWords.has(word)) {
      continue;
    }
    seenWords.add(word);
    cleanWords.push(word);
  }
  
  // Check for repeated phrase patterns (e.g., "flat lay top view flat lay")
  const phraseStr = cleanWords.join(' ');
  const repeatedPatternMatch = phraseStr.match(/^(.+?)\s+\1/);
  if (repeatedPatternMatch) {
    // Remove the repeated portion
    const uniquePhrase = phraseStr.replace(repeatedPatternMatch[0], repeatedPatternMatch[1]);
    return [uniquePhrase.trim()];
  }
  
  // Return as single phrase if multi-word, or individual words
  if (cleanWords.length > 1) {
    return [cleanWords.join(' ')];
  }
  
  return cleanWords;
}

/**
 * TASK 2: Remove semantic duplicates - detect keywords with too similar meaning
 * e.g., "rabbit flat lay", "rabbit flat lay top view", "rabbit top view flat lay"
 */
export function removeSemanticDuplicates(keywords: string[]): string[] {
  if (!keywords || keywords.length === 0) return [];
  
  const result: string[] = [];
  const seenNormalized = new Set<string>();
  
  // Helper to get normalized semantic signature of a keyword
  const getSemanticSignature = (kw: string): string => {
    return kw.toLowerCase()
      .split(/\s+/)
      .sort()
      .join('|');
  };
  
  // Helper to check if two keywords are semantically too similar
  const areSemanticallySimilar = (kw1: string, kw2: string): boolean => {
    const words1 = new Set(kw1.toLowerCase().split(/\s+/));
    const words2 = new Set(kw2.toLowerCase().split(/\s+/));
    
    // If one contains all words of the other, they're too similar
    const intersection = [...words1].filter(w => words2.has(w));
    const minSize = Math.min(words1.size, words2.size);
    
    // If overlap is >80% of the smaller keyword, consider them duplicates
    if (minSize > 0 && intersection.length / minSize >= 0.8) {
      return true;
    }
    
    return false;
  };
  
  for (const keyword of keywords) {
    const normalizedKw = keyword.toLowerCase().trim();
    const signature = getSemanticSignature(normalizedKw);
    
    // Skip if exact semantic signature already exists
    if (seenNormalized.has(signature)) {
      continue;
    }
    
    // Check if semantically similar to any existing keyword
    const isDuplicate = result.some(existing => 
      areSemanticallySimilar(normalizedKw, existing.toLowerCase())
    );
    
    if (!isDuplicate) {
      result.push(keyword);
      seenNormalized.add(signature);
    }
  }
  
  return result;
}

/**
 * TASK 1: Calculate keyword priority score based on Adobe Stock SEO rules
 * Higher score = higher priority for first 10 positions
 */
export function calculateKeywordPriority(keyword: string, visualContext: {
  mainObjects?: string[];
  composition?: string[];
  scene?: string;
}): number {
  let score = 0;
  const lowerKeyword = keyword.toLowerCase().trim();
  const wordCount = lowerKeyword.split(/\s+/).length;
  
  // Priority 1: Exact object match (highest priority) - TASK 1 ENHANCED
  if (visualContext.mainObjects?.some(obj => 
    lowerKeyword === obj.toLowerCase() || lowerKeyword.includes(obj.toLowerCase())
  )) {
    score += 150;
  }
  
  // Priority 2: Main subject relevance with single keyword boost
  if (wordCount === 1 && visualContext.mainObjects?.some(obj => 
    lowerKeyword === obj.toLowerCase()
  )) {
    score += 120;
  } else if (visualContext.mainObjects?.some(obj => 
    lowerKeyword.includes(obj.toLowerCase())
  )) {
    score += 80;
  }
  
  // Priority 3: Commercial usage intent - TASK 8 ENHANCED
  const commercialTerms = ['copy space', 'background', 'banner', 'template', 'flat lay', 'top view', 'mockup', 'advertising', 'isolated', 'white background'];
  if (commercialTerms.some(term => lowerKeyword.includes(term))) {
    score += 70;
  }
  
  // Priority 4: Composition keywords
  if (visualContext.composition?.some(comp => 
    lowerKeyword.includes(comp.toLowerCase())
  )) {
    score += 60;
  }
  
  // Priority 5: Long-tail niche keywords (2-4 words ideal) - TASK 2 & 3 ENHANCED
  if (wordCount >= 2 && wordCount <= 4) {
    score += 50;
  } else if (wordCount === 1) {
    // Single keywords get bonus if they're objects (not adjectives)
    if (!WEAK_ADJECTIVE_BLACKLIST.includes(lowerKeyword)) {
      score += 45;
    } else {
      score += 20;
    }
  } else if (wordCount > 4) {
    // Penalty for too long keywords - TASK 3 ENHANCED
    score -= 30;
  }
  
  // Priority 6: Scene/mood relevance
  if (visualContext.scene && lowerKeyword.includes(visualContext.scene.toLowerCase())) {
    score += 40;
  }
  
  // Penalty: Generic/spam keywords - TASK 2 & 7 ENHANCED
  if (SPAM_KEYWORDS_BLACKLIST.some(spam => lowerKeyword === spam || lowerKeyword.includes(spam))) {
    score -= 150;
  }
  
  // Penalty: Weak adjectives as standalone keywords - TASK 7 ENHANCED
  if (WEAK_ADJECTIVE_BLACKLIST.includes(lowerKeyword) && wordCount === 1) {
    score -= 100;
  }
  
  // Penalty: Too short or single generic word
  if (lowerKeyword.length <= 3 && !['3d', '4k', 'hd', 'ai', 'ui', 'ux'].includes(lowerKeyword)) {
    score -= 30;
  }
  
  return score;
}

/**
 * TASK 2 & 5: Generate long-tail keyword variations with commercial intent
 * Creates searchable phrases buyers actually use - TASK 2 ENHANCED
 */
export function generateLongTailKeywords(
  keywords: string[], 
  visualContext?: {
    mainObject?: string;
    commercialUse?: string[];
    composition?: string[];
  },
  maxVariations: number = 15
): string[] {
  if (!keywords || keywords.length < 2) return [];
  
  const longTailKeywords: string[] = [];
  const seen = new Set<string>();
  
  // Filter out weak adjectives from main objects - TASK 7 ENHANCED
  const strongKeywords = keywords.filter(kw => !WEAK_ADJECTIVE_BLACKLIST.includes(kw.toLowerCase()));
  
  // Get main objects (first 5 strong keywords are typically main subjects)
  const mainObjects = strongKeywords.slice(0, 5);
  
  // Generate combination keywords from main objects - TASK 4 ENHANCED
  for (let i = 0; i < Math.min(mainObjects.length, 4); i++) {
    for (let j = i + 1; j < Math.min(mainObjects.length, 5); j++) {
      const combined = `${mainObjects[i]} ${mainObjects[j]}`;
      const reverseCombined = `${mainObjects[j]} ${mainObjects[i]}`;
      
      // Skip if contains weak adjectives - TASK 7 ENHANCED
      if (WEAK_ADJECTIVE_BLACKLIST.some(adj => combined.toLowerCase().includes(adj))) {
        continue;
      }
      
      if (combined.length <= 50 && !seen.has(combined.toLowerCase())) {
        longTailKeywords.push(combined);
        seen.add(combined.toLowerCase());
      }
      
      if (reverseCombined.length <= 50 && !seen.has(reverseCombined.toLowerCase())) {
        longTailKeywords.push(reverseCombined);
        seen.add(reverseCombined.toLowerCase());
      }
    }
    
    // Add composition combinations only - TASK 6 ENHANCED
    const compositionModifiers = ['flat lay', 'top view', 'overhead', 'isolated', 'copy space', 'white background'];
    compositionModifiers.forEach(comp => {
      const compModified = `${mainObjects[i]} ${comp}`;
      if (!seen.has(compModified.toLowerCase()) && compModified.length <= 50) {
        longTailKeywords.push(compModified);
        seen.add(compModified.toLowerCase());
      }
    });
  }
  
  // Add niche intent phrases based on visual context - TASK 5 ENHANCED
  if (visualContext?.mainObject) {
    const nichePhrases = [
      `${visualContext.mainObject} background`,
      `${visualContext.mainObject} isolated`,
      `professional ${visualContext.mainObject}`,
      `${visualContext.mainObject} flat lay`,
      `${visualContext.mainObject} top view`
    ];
    
    nichePhrases.forEach(phrase => {
      if (!seen.has(phrase.toLowerCase()) && phrase.length <= 50 && phrase.split(' ').length <= 4) {
        longTailKeywords.push(phrase);
        seen.add(phrase.toLowerCase());
      }
    });
  }
  
  return longTailKeywords.slice(0, maxVariations);
}

/**
 * TASK 3: Filter out spam and low-value keywords
 * Removes subjective adjectives, generic terms, and non-buyer-intent keywords - TASK 7 ENHANCED
 */
export function filterSpamKeywords(keywords: string[]): string[] {
  if (!keywords || keywords.length === 0) return [];
  
  return keywords.filter(kw => {
    const lowerKw = kw.toLowerCase().trim();
    const wordCount = lowerKw.split(/\s+/).length;
    
    // Check against expanded spam blacklist - TASK 2 ENHANCED
    if (SPAM_KEYWORDS_BLACKLIST.some(spam => 
      lowerKw === spam || lowerKw.includes(spam)
    )) {
      return false;
    }
    
    // Filter out weak adjectives as standalone keywords - TASK 7 ENHANCED
    if (WEAK_ADJECTIVE_BLACKLIST.includes(lowerKw) && wordCount === 1) {
      return false;
    }
    
    // Filter out overly generic single words (unless they're specific objects)
    if (lowerKw.length <= 4 && wordCount === 1) {
      // Allow specific short words that could be objects
      const allowedShortWords = ['3d', '4k', 'hd', 'ui', 'ux', 'app', 'web', 'seo', 'pdf', 'ai', 'vr', 'ar'];
      if (!allowedShortWords.includes(lowerKw)) {
        return false;
      }
    }
    
    // Filter out keywords longer than 5 words - TASK 3 ENHANCED
    if (wordCount > 5) {
      return false;
    }
    
    return true;
  });
}

/**
 * TASK 4 & 7: Sort keywords by SEO value and buyer intent
 * Prioritizes exact object matches, commercial intent, and long-tail keywords first
 */
export function sortKeywordsBySEO(keywords: string[], visualContext?: {
  mainObjects?: string[];
  composition?: string[];
  scene?: string;
}): string[] {
  if (!keywords || keywords.length === 0) return [];
  
  // Remove duplicates first (case-insensitive)
  const uniqueKeywords = Array.from(
    new Map(keywords.map(kw => [kw.toLowerCase().trim(), kw])).values()
  );
  
  // Score each keyword
  const scoredKeywords = uniqueKeywords.map(kw => ({
    keyword: kw,
    score: calculateKeywordPriority(kw, visualContext || {})
  }));
  
  // Sort by score (descending), then by length (longer first for tie-breaker)
  scoredKeywords.sort((a, b) => {
    if (b.score !== a.score) {
      return b.score - a.score;
    }
    // Tie-breaker: prefer longer, more specific keywords
    const aWords = a.keyword.split(' ').length;
    const bWords = b.keyword.split(' ').length;
    if (bWords !== aWords) {
      return bWords - aWords;
    }
    // Final tie-breaker: alphabetical
    return a.keyword.localeCompare(b.keyword);
  });
  
  return scoredKeywords.map(item => item.keyword);
}

/**
 * TASK 7: Enforce top 10 keywords with strongest relevance and commercial intent
 * Ensures first 10 positions are reserved for highest-value keywords
 */
export function enforceTop10Keywords(
  keywords: string[], 
  visualContext?: {
    mainObjects?: string[];
    composition?: string[];
    scene?: string;
  },
  totalCount: number = 35
): string[] {
  if (!keywords || keywords.length === 0) return [];
  
  // Score and sort all keywords
  const sortedKeywords = sortKeywordsBySEO(keywords, visualContext);
  
  // Take top 10 for highest priority positions
  const top10 = sortedKeywords.slice(0, 10);
  
  // Remaining keywords fill the rest
  const remaining = sortedKeywords.slice(10);
  
  // Combine and limit to total count
  const result = [...top10, ...remaining].slice(0, totalCount);
  
  return result;
}

/**
 * TASK 6: Sanitize keywords for microstock compliance with enhanced SEO optimization
 * Complete pipeline: clean -> normalize -> filter spam -> remove duplicates -> semantic dedupe -> sort by SEO -> enforce top 10
 */
export function sanitizeKeywords(
  keywords: string[], 
  maxCount: number = 35,
  visualContext?: {
    mainObjects?: string[];
    composition?: string[];
    scene?: string;
  }
): string[] {
  if (!keywords || keywords.length === 0) return [];
  
  // Forbidden technical/medium indicators for microstock 2026
  const FORBIDDEN_TERMS = [
    '4k', '8k', 'hd', 'uhd', 'hdr', 'resolution', 'megapixel', 'mp',
    'camera', 'dslr', 'canon', 'nikon', 'sony', 'fujifilm', 'panasonic',
    'photography', 'photo', 'photograph', 'image', 'picture', 'pic',
    'vector', 'illustration', 'clipart', 'eps', 'ai', 'svg', 'png', 'jpg', 'jpeg',
    'ultra', 'high quality', 'best quality', 'masterpiece', 'render', '3d render',
    'file', 'download', 'free', 'sample', 'preview', 'watermark'
  ];
  
  // Step 1: Clean and normalize each keyword - TASK 1 & 5
  let cleaned = keywords
    .map(kw => String(kw))
    .map(kw => kw.trim())
    .map(kw => kw.replace(/[^a-z0-9\s-]/gi, ''))
    .map(kw => kw.toLowerCase())
    .map(kw => kw.replace(/\s+/g, ' '))
    .filter(kw => kw.length >= 2 && kw.length <= 50);
  
  // Step 2: Remove forbidden terms
  cleaned = cleaned.filter(kw => {
    return !FORBIDDEN_TERMS.some(term =>
      kw === term || kw.includes(term)
    );
  });
  
  // Step 3: Filter spam keywords using expanded blacklist
  cleaned = filterSpamKeywords(cleaned);
  
  // Step 4: Normalize keyword phrases - remove looping and repeated words (TASK 1)
  cleaned = cleaned.flatMap(kw => normalizeKeywordPhrase(kw));
  
  // Step 5: Remove exact duplicates (case-insensitive)
  cleaned = Array.from(
    new Map(cleaned.map(kw => [kw.toLowerCase(), kw])).values()
  );
  
  // Step 6: Remove semantic duplicates (TASK 2)
  cleaned = removeSemanticDuplicates(cleaned);
  
  // Step 7: Generate long-tail variations and add them
  const longTail = generateLongTailKeywords(cleaned, visualContext ? {
    mainObject: visualContext.mainObjects?.[0],
    commercialUse: ['copy space', 'background', 'template'],
    composition: visualContext.composition
  } : undefined, 10);
  
  cleaned = [...cleaned, ...longTail];
  
  // Step 8: Remove duplicates again after long-tail generation
  cleaned = Array.from(
    new Map(cleaned.map(kw => [kw.toLowerCase(), kw])).values()
  );
  
  // Step 9: Remove semantic duplicates again after long-tail generation
  cleaned = removeSemanticDuplicates(cleaned);
  
  // Step 10: Sort by SEO value with visual context
  cleaned = sortKeywordsBySEO(cleaned, visualContext);
  
  // Step 11: Enforce top 10 keywords for highest search intent
  cleaned = enforceTop10Keywords(cleaned, visualContext, maxCount);
  
  // Step 12: Limit to max count
  return cleaned.slice(0, maxCount);
}

/**
 * Apply user preferences to metadata output
 * - Enforces title length limit
 * - Enforces description length limit  
 * - Enforces exact keyword count
 * - Prioritizes key concepts if provided
 */
export function applyUserPreferences(
  metadata: { title: string; description: string; keywords: string[]; categories?: Record<string, string> },
  settings: {
    titleLength?: number;
    descLength?: number;
    keywordsCount?: number;
    keyConcepts?: string;
  }
): { title: string; description: string; keywords: string[]; categories?: Record<string, string> } {
  const titleLimit = settings.titleLength || 70;
  const descLimit = settings.descLength || 160;
  const keywordCount = settings.keywordsCount || 35;
  const keyConcepts = settings.keyConcepts?.split(',').map(c => c.trim().toLowerCase()).filter(Boolean) || [];

  // Apply title truncation
  let title = truncateByCharacters(metadata.title || '', titleLimit);

  // Apply description truncation
  let description = truncateByCharacters(metadata.description || '', descLimit);

  // Apply keyword sanitization and count enforcement
  let keywords = sanitizeKeywords(metadata.keywords || [], keywordCount);

  // Prioritize key concepts by moving them to the front
  if (keyConcepts.length > 0) {
    const remainingKeywords = keywords.filter(kw => !keyConcepts.includes(kw));
    const matchedConcepts = keyConcepts.filter(concept => 
      keywords.some(kw => kw === concept || kw.includes(concept))
    );
    
    // Add concepts that weren't found (optional fallback)
    const unmatchedConcepts = keyConcepts.filter(concept => 
      !matchedConcepts.includes(concept)
    );
    
    keywords = [...matchedConcepts, ...remainingKeywords].slice(0, keywordCount);
    
    // If still under count, add back unmatched concepts as new keywords
    if (keywords.length < keywordCount && unmatchedConcepts.length > 0) {
      for (const concept of unmatchedConcepts) {
        if (keywords.length >= keywordCount) break;
        if (!keywords.includes(concept)) {
          keywords.push(concept);
        }
      }
    }
  }

  // Final trim to exact count
  keywords = keywords.slice(0, keywordCount);

  return {
    title,
    description,
    keywords,
    categories: metadata.categories
  };
}

/**
 * Detect commercial intent in keywords
 * Returns score 0-100 based on buyer intent strength
 */
export function detectCommercialIntent(keywords: string[]): number {
  if (!keywords || keywords.length === 0) return 0;

  let score = 0;
  const lowerKeywords = keywords.map(kw => kw.toLowerCase());

  // Check for commercial keywords presence
  COMMERCIAL_KEYWORDS.forEach(commercial => {
    if (lowerKeywords.some(kw => kw.includes(commercial))) {
      score += 15;
    }
  });

  // Check for action/buyer intent words
  const buyerIntentWords = ['buy', 'sale', 'download', 'vector', 'eps', 'png', 'svg', 'editable', 'customizable', 'printable', 'template', 'kit', 'bundle', 'pack', 'set'];
  buyerIntentWords.forEach(word => {
    if (lowerKeywords.some(kw => kw.includes(word))) {
      score += 5;
    }
  });

  // Cap at 100
  return Math.min(score, 100);
}

/**
 * Optimize keywords for microstock platforms (Adobe Stock, Shutterstock, Freepik, iStock 2026)
 * Combines all SEO optimizations: filtering, sorting, long-tail generation, deduplication
 * Limits to maximum 35 keywords as per platform best practices
 */
export function optimizeMicrostockKeywords(keywords: string[], maxKeywords: number = 35): string[] {
  if (!keywords || keywords.length === 0) return [];

  // Step 1: Clean and normalize keywords
  let cleaned = keywords
    .map(kw => kw.trim())
    .filter(kw => kw.length > 0 && kw.length <= 50);

  // Step 2: Remove duplicates (case-insensitive)
  const seen = new Set<string>();
  cleaned = cleaned.filter(kw => {
    const lower = kw.toLowerCase();
    if (seen.has(lower)) return false;
    seen.add(lower);
    return true;
  });

  // Step 3: Filter spam keywords
  cleaned = filterSpamKeywords(cleaned);

  // Step 4: Generate long-tail variations
  const longTail = generateLongTailKeywords(cleaned, undefined, 10);
  cleaned = [...cleaned, ...longTail];

  // Step 5: Remove duplicates again after long-tail generation
  seen.clear();
  cleaned = cleaned.filter(kw => {
    const lower = kw.toLowerCase();
    if (seen.has(lower)) return false;
    seen.add(lower);
    return true;
  });

  // Step 6: Sort by SEO value
  cleaned = sortKeywordsBySEO(cleaned);

  // Step 7: Limit to max keywords
  cleaned = cleaned.slice(0, maxKeywords);

  return cleaned;
}

/**
 * Truncate text by character count without cutting words
 * Ensures natural sentence breaks
 */
export function truncateByCharacters(text: string, maxChars: number): string {
  if (!text || text.length <= maxChars) return text || '';
  
  // Try to cut at last space before maxChars
  let truncated = text.substring(0, maxChars);
  const lastSpace = truncated.lastIndexOf(' ');
  
  if (lastSpace > maxChars * 0.7) {
    // Cut at word boundary if we're past 70% of max length
    truncated = truncated.substring(0, lastSpace);
  }
  
  // Ensure we don't end with punctuation issues
  truncated = truncated.replace(/[.,!?;:]+$/, '');
  
  return truncated.trim();
}

/**
 * Truncate text by word count
 * Keeps exactly N words
 */
export function truncateByWords(text: string, maxWords: number): string {
  if (!text) return '';
  
  const words = text.split(/\s+/).filter(w => w.length > 0);
  if (words.length <= maxWords) return text;
  
  return words.slice(0, maxWords).join(' ').trim();
}

/**
 * Sanitize metadata output to enforce user preferences
 * Enforces title length, description length, and keyword count limits
 */
export function sanitizeMetadataOutput(
  metadata: { title: string; description: string; keywords: string[] },
  settings: {
    titleLength?: number;
    descLength?: number;
    keywordsCount?: number;
  }
): { title: string; description: string; keywords: string[] } {
  // Default values if settings are missing
  const titleLimit = settings.titleLength || 70;
  const descLimit = settings.descLength || 160;
  const keywordCount = settings.keywordsCount || 35;

  console.log("Applied AI Preferences:", {
    titleLength: titleLimit,
    keywordsCount: keywordCount,
    descriptionLength: descLimit
  });

  // Sanitize title
  let sanitizedTitle = (metadata.title || '').trim();
  sanitizedTitle = truncateByCharacters(sanitizedTitle, titleLimit);

  // Sanitize description
  let sanitizedDescription = (metadata.description || '').trim();
  sanitizedDescription = truncateByCharacters(sanitizedDescription, descLimit);

  // Sanitize keywords
  let sanitizedKeywords = metadata.keywords || [];
  
  // Clean keywords: trim, remove empty, remove duplicates
  sanitizedKeywords = sanitizedKeywords
    .map(kw => kw.trim())
    .filter(kw => kw.length > 0 && kw.length <= 50);
  
  // Remove duplicates (case-insensitive)
  const seen = new Set<string>();
  sanitizedKeywords = sanitizedKeywords.filter(kw => {
    const lower = kw.toLowerCase();
    if (seen.has(lower)) return false;
    seen.add(lower);
    return true;
  });
  
  // Remove spam keywords
  sanitizedKeywords = filterSpamKeywords(sanitizedKeywords);
  
  // Apply SEO optimization (includes sorting by commercial intent)
  sanitizedKeywords = optimizeMicrostockKeywords(sanitizedKeywords, keywordCount);
  
  // Ensure exact keyword count
  if (sanitizedKeywords.length > keywordCount) {
    sanitizedKeywords = sanitizedKeywords.slice(0, keywordCount);
  }

  return {
    title: sanitizedTitle,
    description: sanitizedDescription,
    keywords: sanitizedKeywords
  };
}

// =========================================
// EXISTING UTILITY FUNCTIONS
// =========================================

// Scan text for potential IP or Trademark violations
export function scanIPViolations(text: string): string[] {
  if (!text) return [];
  const lowerText = text.toLowerCase();
  const detected: string[] = [];
  
  BANNED_TRADEMARKS.forEach(brand => {
    const regex = new RegExp(`\\b${brand}\\b`, 'i');
    if (regex.test(lowerText)) {
      detected.push(brand);
    }
  });
  
  return detected;
}

// Measure SEO quality of title and keywords
export function measureSEOQuality(item: QueueItem): { score: number; issues: string[] } {
  let score = 100;
  const issues: string[] = [];
  const title = item.metadata.title || "";
  const description = item.metadata.description || "";
  let keywords = item.metadata.keywords || [];

  // Optimize keywords using new SEO function
  keywords = optimizeMicrostockKeywords(keywords);

  // Title validation
  if (title.length < 15) {
    score -= 20;
    issues.push("Judul terlalu pendek (kurang dari 15 karakter)");
  } else if (title.length > (item.settings?.titleLength || 80) + 20) {
    score -= 10;
    issues.push("Judul melebihi preferensi target");
  }

  // Description validation
  if (description.length < 30) {
    score -= 15;
    issues.push("Deskripsi terlalu singkat (kurang dari 30 karakter)");
  }

  // Keywords counts
  const targetKeywords = item.settings?.keywordsCount || 40;
  if (keywords.length < 15) {
    score -= 25;
    issues.push("Jumlah kata kunci terlalu sedikit (kurang dari 15)");
  } else if (keywords.length < targetKeywords - 5) {
    score -= 10;
    issues.push(`Target kata kunci belum maksimal (baru ${keywords.length}/${targetKeywords})`);
  }

  // Low value keywords detection (spam metrics)
  const lowValueKeywords = ['cool', 'nice', 'beautiful', 'image', 'photo', 'vector', 'illustration', 'clipart', 'camera', 'dslr'];
  const spamDetected = keywords.filter(kw => lowValueKeywords.includes(kw.toLowerCase()));
  if (spamDetected.length > 0) {
    score -= (spamDetected.length * 5);
    issues.push(`Terdeteksi kata kunci bernilai rendah/spam (${spamDetected.slice(0, 3).join(', ')})`);
  }

  // Trademark detection in keywords check
  const trademarkKws = keywords.filter(kw => {
    const violations = scanIPViolations(kw);
    return violations.length > 0;
  });
  if (trademarkKws.length > 0) {
    score -= 30;
    issues.push(`Mengandung keyword trademark terlarang (${trademarkKws.join(', ')})`);
  }

  return {
    score: Math.max(score, 10),
    issues: issues
  };
}

// Generate metadata using Groq API
export async function generateMetadata(imageDescription: string): Promise<string> {
  const response = await fetch("/api/generate-metadata", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ imageDescription }),
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error?.message || "Gagal menghasilkan metadata");
  }
  return data.content;
}

// Image compression
export function resizeAndCompressImage(
  base64Str: string,
  maxWidth = 1024,
  maxHeight = 1024
): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image();
    img.src = `data:image/png;base64,${base64Str}`;
    img.onload = () => {
      let width = img.width;
      let height = img.height;

      // Calculate optimal resolution
      if (width > maxWidth || height > maxHeight) {
        if (width > height) {
          height = Math.round((height * maxWidth) / width);
          width = maxWidth;
        } else {
          width = Math.round((width * maxHeight) / height);
          height = maxHeight;
        }
      }

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(img, 0, 0, width, height);
      }

      // Compress to JPEG with 75% quality for performance
      const compressedDataUrl = canvas.toDataURL('image/jpeg', 0.75);
      resolve(compressedDataUrl.split(',')[1]);
    };
    img.onerror = () => {
      resolve(base64Str); // Fallback
    };
  });
}

// Extract three frames from video: Start (10%), Middle (50%), End (90%)
export function extractVideoFrames(file: File): Promise<string[]> {
  return new Promise((resolve) => {
    const video = document.createElement('video');
    video.src = URL.createObjectURL(file);
    video.muted = true;
    video.playsInline = true;
    video.crossOrigin = 'anonymous';

    video.onloadedmetadata = () => {
      const duration = video.duration;
      const timestamps = [duration * 0.1, duration * 0.5, duration * 0.9];
      const frames: string[] = [];
      let index = 0;

      const captureFrame = () => {
        if (index >= timestamps.length) {
          URL.revokeObjectURL(video.src);
          resolve(frames);
          return;
        }
        video.currentTime = timestamps[index];
      };

      video.onseeked = () => {
        const canvas = document.createElement('canvas');
        canvas.width = video.videoWidth || 640;
        canvas.height = video.videoHeight || 360;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        }
        const dataUrl = canvas.toDataURL('image/png');
        frames.push(dataUrl.split(',')[1]);
        index++;
        captureFrame();
      };

      captureFrame();
    };

    video.onerror = () => {
      resolve([]);
    };
  });
}

// CSV Generator conforming to microstock specifications
export function generatePlatformCSV(successItems: QueueItem[], platformKey: string): void {
  if (successItems.length === 0) return;

  let csvContent = "";
  let fileName = "";

  const sanitizeCSV = (str: string) => `"${str.replace(/"/g, '""')}"`;

  switch (platformKey) {
    case 'shutterstock':
      csvContent = "Filename,Description,Keywords,Category 1,Category 2\n" + 
        successItems.map(i => [
          sanitizeCSV(i.name),
          sanitizeCSV(i.metadata.description),
          sanitizeCSV(i.metadata.keywords.join(',')),
          sanitizeCSV(i.metadata.categories?.shutterstock1 || 'Abstract'),
          sanitizeCSV(i.metadata.categories?.shutterstock2 || '')
        ].join(",")).join("\n");
      fileName = `shutterstock_batch_${Date.now()}.csv`;
      break;

    case 'adobeStock':
      csvContent = "Filename,Title,Keywords,Category\n" + 
        successItems.map(i => [
          sanitizeCSV(i.name),
          sanitizeCSV(i.metadata.title),
          sanitizeCSV(i.metadata.keywords.join(',')),
          sanitizeCSV(i.metadata.categories?.adobeStock || 'Graphics')
        ].join(",")).join("\n");
      fileName = `adobe_stock_batch_${Date.now()}.csv`;
      break;

    case 'freepik':
      csvContent = "Filename,Title,Keywords\n" + 
        successItems.map(i => [
          sanitizeCSV(i.name),
          sanitizeCSV(i.metadata.title),
          sanitizeCSV(i.metadata.keywords.join(','))
        ].join(",")).join("\n");
      fileName = `freepik_batch_${Date.now()}.csv`;
      break;

    case 'istock':
      csvContent = "Filename,Title,Description,Keywords\n" + 
        successItems.map(i => [
          sanitizeCSV(i.name),
          sanitizeCSV(i.metadata.title),
          sanitizeCSV(i.metadata.description),
          sanitizeCSV(i.metadata.keywords.join(','))
        ].join(",")).join("\n");
      fileName = `istock_getty_batch_${Date.now()}.csv`;
      break;

    case 'vecteezy':
      csvContent = "Filename,Title,Description,Keywords,Category\n" + 
        successItems.map(i => [
          sanitizeCSV(i.name),
          sanitizeCSV(i.metadata.title),
          sanitizeCSV(i.metadata.description),
          sanitizeCSV(i.metadata.keywords.join(',')),
          sanitizeCSV(i.metadata.categories?.vecteezy || 'Backgrounds')
        ].join(",")).join("\n");
      fileName = `vecteezy_batch_${Date.now()}.csv`;
      break;

    case 'canva':
      csvContent = "Filename,Title,Description,Keywords,Theme\n" + 
        successItems.map(i => [
          sanitizeCSV(i.name),
          sanitizeCSV(i.metadata.title),
          sanitizeCSV(i.metadata.description),
          sanitizeCSV(i.metadata.keywords.join(',')),
          sanitizeCSV(i.metadata.categories?.canva || 'Elements')
        ].join(",")).join("\n");
      fileName = `canva_batch_${Date.now()}.csv`;
      break;

    case 'dreamstime':
      csvContent = "Filename,Title,Description,Keywords,Category\n" + 
        successItems.map(i => [
          sanitizeCSV(i.name),
          sanitizeCSV(i.metadata.title),
          sanitizeCSV(i.metadata.description),
          sanitizeCSV(i.metadata.keywords.join(',')),
          sanitizeCSV(i.metadata.categories?.dreamstime || 'Abstract')
        ].join(",")).join("\n");
      fileName = `dreamstime_batch_${Date.now()}.csv`;
      break;

    default:
      return;
  }

  // Trigger browser download in UTF-8
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.setAttribute("href", url);
  link.setAttribute("download", fileName);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
