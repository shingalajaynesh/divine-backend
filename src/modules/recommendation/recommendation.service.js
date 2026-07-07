import { calculatePregnancyStats } from '../../util/pregnancy.js';

export class RecommendationService {
  constructor(models, sequelize) {
    this.models = models;
    this.sequelize = sequelize;
  }

  async getRecommendations(user) {
    // 1. Check pregnancy stats
    const stats = calculatePregnancyStats(user.lmpDate, user.dueDate);
    const trimester = stats.currentTrimester || 1;
    const week = stats.currentWeek || 1;

    // 2. Fetch latest wellness log
    const latestVitals = await this.models.VitalsLog.findOne({
      where: { userId: user.id },
      order: [['loggedAt', 'DESC']]
    });

    // 3. Fetch active subscription status
    const sub = await this.models.UserSubscription.findOne({
      where: { userId: user.id },
      include: [{ model: this.models.SubscriptionPlan, as: 'plan' }]
    });
    const isPremium = !!(sub && (sub.status === 'active' || sub.status === 'trialing'));

    const recommendations = [];

    // --- RULE A: Plan Entitlement & CTA ---
    if (!isPremium) {
      recommendations.push({
        id: 'cta-upgrade',
        title: 'Unlock Personalized Premium Garbh Sanskar',
        description: 'Upgrade to a Premium plan to unlock personalized daily module flows, active webinar sessions, and unlimited consulting bookings.',
        category: 'CALL_TO_ACTION',
        icon: '👑',
        actionLink: '/pricing',
        isPremium: false,
        unlocked: true
      });
    }

    // --- RULE B: Trimester Specific Recommendations ---
    if (trimester === 1) {
      recommendations.push({
        id: 'trim1-diet',
        title: 'Folate & Hydration Focus (Trimester 1)',
        description: 'During weeks 1-13, neural tube development is rapid. Prioritize folate-rich foods like spinach, lentils, and citrus fruits.',
        category: 'DIET',
        icon: '🥬',
        actionLink: '/diet-planner',
        isPremium: false,
        unlocked: true
      });
      recommendations.push({
        id: 'trim1-mindful',
        title: 'Daily Garbh Sanskar Prayer',
        description: 'Start your morning with a 5-minute peace prayer to create a tranquil environment for your baby.',
        category: 'MINDFULNESS',
        icon: '🙏',
        actionLink: '/programmes',
        isPremium: false,
        unlocked: true
      });
      recommendations.push({
        id: 'trim1-premium-yoga',
        title: 'Trimester 1 Gentle Yoga',
        description: 'Exclusive first trimester yoga module designed to build initial strength and support body changes.',
        category: 'EXERCISE',
        icon: '🧘‍♀️',
        actionLink: '/programmes',
        isPremium: true,
        unlocked: isPremium
      });
    } else if (trimester === 2) {
      recommendations.push({
        id: 'trim2-diet',
        title: 'Calcium & Iron Enrichment (Trimester 2)',
        description: 'Weeks 14-26 require increased blood volume. Combine iron-rich foods with Vitamin C for optimal absorption.',
        category: 'DIET',
        icon: '🥦',
        actionLink: '/diet-planner',
        isPremium: false,
        unlocked: true
      });
      recommendations.push({
        id: 'trim2-mindful',
        title: 'Spiritual Reading (Swadhyaya)',
        description: 'Read inspirational stories to cultivate positive thoughts and values in your baby.',
        category: 'MINDFULNESS',
        icon: '📖',
        actionLink: '/programmes',
        isPremium: false,
        unlocked: true
      });
      recommendations.push({
        id: 'trim2-premium-webinar',
        title: 'Live Weekly Trimester 2 Coaching Session',
        description: 'Join coaches live to discuss pelvic alignment, posture corrections, and sleep positions.',
        category: 'CALL_TO_ACTION',
        icon: '🎥',
        actionLink: '/classes',
        isPremium: true,
        unlocked: isPremium
      });
    } else {
      recommendations.push({
        id: 'trim3-diet',
        title: 'Magnesium & Energy Boosters (Trimester 3)',
        description: 'Weeks 27-40 demand extra energy. Keep meals smaller but more frequent to prevent heartburn and support growth.',
        category: 'DIET',
        icon: '🥚',
        actionLink: '/diet-planner',
        isPremium: false,
        unlocked: true
      });
      recommendations.push({
        id: 'trim3-mindful',
        title: 'Preparation & Breathing Audios',
        description: 'Calm labor preparation audio tracks to teach deep diaphragmatic breathing and muscle relaxation.',
        category: 'AUDIO',
        icon: '🎵',
        actionLink: '/programmes',
        isPremium: false,
        unlocked: true
      });
      recommendations.push({
        id: 'trim3-contraction',
        title: 'Labor Contraction Tracker',
        description: 'Keep your contraction timer configured and know the 5-1-1 active labor warning parameters.',
        category: 'CLINICAL',
        icon: '⏱️',
        actionLink: '/pregnancy-tools',
        isPremium: true,
        unlocked: isPremium
      });
    }

    // --- RULE C: Tracked Behavior & Symptom Adaptations ---
    if (latestVitals) {
      let parsedSymptoms = [];
      try {
        parsedSymptoms = JSON.parse(latestVitals.symptoms || '[]');
      } catch (e) {}

      if (parsedSymptoms.includes('Nausea')) {
        recommendations.push({
          id: 'symptom-nausea',
          title: 'Ginger Infusions & Small Meals',
          description: 'You logged experiencing Nausea. Try drinking warm ginger or peppermint tea, and chew dry crackers before getting out of bed.',
          category: 'CLINICAL',
          icon: '🍵',
          actionLink: '/diet-planner',
          isPremium: false,
          unlocked: true
        });
      }

      if (parsedSymptoms.includes('Insomnia') || (latestVitals.sleepHours !== null && latestVitals.sleepHours !== undefined && latestVitals.sleepHours < 7)) {
        recommendations.push({
          id: 'symptom-insomnia',
          title: 'Soothing Ambient Ocean Sleep Audio',
          description: 'Logged sleep is below recommended rest. Listen to our soothing ambient ocean waves playlist for 15 minutes before bed.',
          category: 'AUDIO',
          icon: '😴',
          actionLink: '/programmes',
          isPremium: false,
          unlocked: true
        });
      }

      if (parsedSymptoms.includes('Backache')) {
        recommendations.push({
          id: 'symptom-backache',
          title: 'Pelvic Tilts & Back Stretches',
          description: 'Experiencing backache is common. Gentle cat-cow stretches and pelvic tilts can alleviate lower back pressure.',
          category: 'EXERCISE',
          icon: '🧘‍♀️',
          actionLink: '/programmes',
          isPremium: false,
          unlocked: true
        });
      }

      if (latestVitals.mood === 'ANXIOUS' || latestVitals.mood === 'SAD') {
        recommendations.push({
          id: 'mood-anxious',
          title: 'Calming Positive Affirmations',
          description: 'Your mood log indicates feeling anxious or sad. Repeat: "My body is strong, my baby is safe, and I am supported."',
          category: 'MINDFULNESS',
          icon: '❤️',
          actionLink: '/programmes',
          isPremium: false,
          unlocked: true
        });
      }

      if (latestVitals.hydrationWater !== null && latestVitals.hydrationWater !== undefined && latestVitals.hydrationWater < 2.5) {
        recommendations.push({
          id: 'hydration-low',
          title: 'Hydration Intake Alert',
          description: 'Your logged water intake is low. Please take a glass of water now to maintain healthy amniotic fluid.',
          category: 'CLINICAL',
          icon: '💧',
          actionLink: '/vitals',
          isPremium: false,
          unlocked: true
        });
      }
    }

    return recommendations;
  }
}
