import { Challenge } from '@/lib/supabase'
import type { Language } from '@/lib/LanguageContext'

// Translations for challenge content that lives in the database.
//
// The challenges table is a fixed, curated library seeded from
// supabase-schema.sql, so translations are kept here alongside the code rather
// than added as *_ar columns. That keeps the Arabic copy reviewable in a pull
// request, and it means the UI needs no extra query.
//
// Keyed by the English title rather than the UUID, because the IDs are
// regenerated whenever the seed function re-runs. A challenge with no entry
// here simply falls back to its English text rather than rendering a key.

interface ChallengeAr {
  title: string
  description: string
}

export const CHALLENGE_AR: Record<string, ChallengeAr> = {
  'Give a genuine compliment': {
    title: 'قدّم مجاملة صادقة',
    description:
      'امدح أحدهم اليوم بعبارة صادقة ومحددة. اجعلها صادقة وتستند إلى شيء ذي قيمة.',
  },
  'Thank someone from your past': {
    title: 'اشكر شخصاً من ماضيك',
    description:
      'تواصل مع شخص ساعدك في الماضي واشكره. أخبره تحديداً بما فعله وكيف أثّر في حياتك.',
  },
  'Buy someone a small treat': {
    title: 'أطعم أحدهم',
    description:
      'اشترِ لشخص قهوة أو وجبة خفيفة أو وجبة صغيرة. قد يكون صديقاً أو زميلاً أو حتى شخصاً غريباً.',
  },
  'Send an encouraging message': {
    title: 'أرسل رسالة تشجيع',
    description:
      'أرسل رسالة مشجّعة لشخص يحتاجها الآن. فكّر في شخص يمرّ بوقت صعب.',
  },
  'Leave a generous tip': {
    title: 'اترك بقشيشاً سخياً',
    description: 'اترك بقشيشاً سخياً لشخص يعمل في خدمة الناس، مع كلمة طيبة.',
  },

  'Help carry something heavy': {
    title: 'ساعد في حمل شيء ثقيل',
    description:
      'ساعد شخصاً يحمل أكياس التسوق أو ينقل الأثاث أو يجاهد مع حمولة ثقيلة.',
  },
  'Teach someone a skill': {
    title: 'علّم أحدهم مهارة',
    description: 'شارك ما تعرف. علّم شخصاً شيئاً تتقنه.',
  },
  'Help a neighbor with a task': {
    title: 'ساعد جاراً في مهمة',
    description:
      'اعرض مساعدة جارك في شيء عملي: تنظيف الحديقة، أو حل مشكلة تقنية، أو مهمة منزلية.',
  },
  'Give directions or assistance': {
    title: 'دلّ شخصاً على الطريق',
    description:
      'ساعد شخصاً يبدو تائهاً أو مشوشاً. قدّم له شرحاً واضحاً وصبوراً للطريق أو للمساعدة.',
  },

  'Pick up litter': {
    title: 'التقط الفضلات',
    description: 'أمضِ 15 دقيقة في جمع الفضلات من مكان عام. لا تنسَ إحضار كيس وقفازات.',
  },
  'Donate useful items': {
    title: 'تبرّع بأشياء نافعة',
    description:
      'تبرّع بالملابس والكتب والأشياء التي لم تعد بحاجة إليها إلى جمعية خيرية أو دار رعاية قريبة منك.',
  },
  'Support a local business': {
    title: 'ادعم متجراً محلياً',
    description: 'زُر متجراً صغيراً في محيطك واشترِ منه شيئاً، ثم اترك تقييماً إيجابياً.',
  },

  'Donate to a charity': {
    title: 'تبرّع لجمعية خيرية',
    description:
      'تبرّع بخمسة دولارات أو أكثر لجمعية من اختيارك. ابحث واختر جمعية تعبّر عن ما يهمك.',
  },
  'Pay for someone behind you': {
    title: 'ادفع عن الشخص خلفك',
    description:
      'ادفع فاتورة الشخص الذي يقف خلفك في الطابور، سواء في مقهى أو عند الطلب بالسيارة.',
  },
  'Give your time': {
    title: 'عطِ وقتك',
    description: 'تطوّع بساعة من وقتك لمساعدة شخص أو منظمة.',
  },

  'Create art for someone': {
    title: 'اصنع عملاً فنياً لشخص',
    description:
      'ارسم لوحة أو اصنع قطعة يدوية وأهدها لشخص ما. لا يلزم أن تكون مثالية، المهم أنها صادرة من قلبك.',
  },
  'Write an encouraging note': {
    title: 'اكتب كلمة تشجيع',
    description:
      'اكتب ملاحظة صادقة ومشجّعة، وأعطها لشخص تعرفه أو اتركها في مكان ما ليجدها شخص غريب.',
  },
  'Create something that makes someone smile': {
    title: 'اصنع شيئاً يرسم الابتسامة',
    description:
      'ابتكر شيئاً طريفاً — فيديو مضحكاً أو نكتة أو أغنية — من أجل أن يبتسم أحدهم اليوم.',
  },

  'Make someone laugh': {
    title: 'أضحك أحدهم',
    description:
      'قل نكتة، أو شارك قصة طريفة، أو افعل شيئاً ساذجاً على أن يضحك أحدهم فعلاً اليوم.',
  },
  'Organize a surprise gathering': {
    title: 'نظّم تجمّعاً مفاجئاً',
    description:
      'نظّم لقاءً صغيراً مفاجئاً أو نشاطاً لصديق أو زميل. اجعله بسيطاً وممتعاً.',
  },
  'Share something that made you smile': {
    title: 'شارك شيئاً أضحكك',
    description: 'شارك فيديو أو نكتة أو قصة طريفة مع شخص يحتاج إلى ضحكة اليوم.',
  },

  'Learn and teach something new': {
    title: 'تعلّم وشارك شيئاً جديداً',
    description:
      'تعلّم شيئاً جديداً اليوم وشاركه مع شخص آخر. قد تكون معلومة أو مهارة أو فكرة.',
  },
  'Share a valuable resource': {
    title: 'شارك مصدراً قيّماً',
    description:
      'شارك كتاباً أو مقالاً أو فيديو أو مصدراً غيّر نظرتك، مع شخص قد يستفيد منه.',
  },
  'Mentor someone': {
    title: 'كن مرشداً لأحدهم',
    description:
      'اعرض أن ترشد شخصاً في مجال تملك فيه خبرة، وأجرِ معه محادثة ذات معنى.',
  },
}

export const DIFFICULTY_AR: Record<string, string> = {
  easy: 'سهل',
  medium: 'متوسط',
  hard: 'صعب',
}

// Durations are free text like "5-10 minutes" or "1-2 hours", so only the unit
// word is swapped and the numbers are left alone. Translating the whole string
// per challenge would mean duplicating data that never changes.
const TIME_UNITS: [RegExp, string][] = [
  [/\bminutes\b/g, 'دقائق'],
  [/\bminute\b/g, 'دقيقة'],
  [/\bhours\b/g, 'ساعات'],
  [/\bhour\b/g, 'ساعة'],
]

export function translateEstimatedTime(value?: string): string {
  if (!value) return ''
  let out = value
  for (const [pattern, arabic] of TIME_UNITS) {
    out = out.replace(pattern, arabic)
  }
  return out
}

export interface LocalizedChallenge {
  title: string
  description: string
  difficulty: string
  estimatedTime: string
}

export function localizeChallenge(
  challenge: Partial<Challenge> | null | undefined,
  language: Language
): LocalizedChallenge {
  const title = challenge?.title || ''
  const description = challenge?.description || ''
  const difficulty = challenge?.difficulty || ''
  const estimatedTime = challenge?.estimated_time || ''

  if (language !== 'ar') {
    return { title, description, difficulty, estimatedTime }
  }

  const ar = CHALLENGE_AR[title]

  return {
    title: ar?.title || title,
    description: ar?.description || description,
    difficulty: DIFFICULTY_AR[difficulty] || difficulty,
    estimatedTime: translateEstimatedTime(estimatedTime),
  }
}
