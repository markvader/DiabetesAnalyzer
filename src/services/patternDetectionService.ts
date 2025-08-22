import { toMmol } from '../utils/glucoseUtils';

// Update the predictGlucose function
export const predictGlucose = async (readings: any[]): Promise<number[]> => {
  if (!readings || readings.length < 24) return [];

  const lookback = 12; // Use last hour of readings
  const horizon = 36; // 3 hours of predictions (5-minute intervals)
  const features = [];
  const labels = [];

  // Prepare data
  for (let i = lookback; i < readings.length; i++) {
    const feature = readings.slice(i - lookback, i).map(r => r.sgv);
    const label = readings[i].sgv;
    features.push(feature);
    labels.push(label);
  }

  try {
    // Simple exponential smoothing prediction
    const predictions = [];
    let currentFeature = [...readings.slice(-lookback).map(r => r.sgv)];
    const alpha = 0.3; // Smoothing factor

    // Calculate trend from recent readings
    const recentSlope = (currentFeature[currentFeature.length - 1] - currentFeature[0]) / currentFeature.length;
    
    for (let i = 0; i < horizon; i++) {
      // Use exponential smoothing with trend adjustment
      const lastValue = currentFeature[currentFeature.length - 1];
      const prediction = Math.round(lastValue + recentSlope * (i + 1));
      
      // Ensure predictions stay within reasonable bounds
      const boundedPrediction = Math.max(40, Math.min(400, prediction));
      predictions.push(boundedPrediction);
      
      // Update feature window for next prediction
      currentFeature = [...currentFeature.slice(1), boundedPrediction];
    }

    return predictions;
  } catch (error) {
    console.error('Error in predictGlucose:', error);
    return [];
  }
};

// Detect glucose patterns throughout the day
export const detectGlucosePatterns = (entries: any[]): any[] => {
  const timeSlots = [
    { name: 'Early Morning', start: 4, end: 8 },
    { name: 'Morning', start: 8, end: 12 },
    { name: 'Afternoon', start: 12, end: 17 },
    { name: 'Evening', start: 17, end: 22 },
    { name: 'Night', start: 22, end: 4 }
  ];

  return timeSlots.map(slot => {
    const slotReadings = entries.filter(entry => {
      const hour = new Date(entry.date).getHours();
      return slot.start <= hour && (slot.end > slot.start ? hour < slot.end : hour < 24 || hour < slot.end);
    });

    const glucoseValues = slotReadings.map(r => r.sgv);
    const avgGlucose = glucoseValues.reduce((a, b) => a + b, 0) / glucoseValues.length;
    const variability = Math.sqrt(
      glucoseValues.reduce((acc, val) => acc + Math.pow(val - avgGlucose, 2), 0) / glucoseValues.length
    );

    // Determine trend
    const trend = (() => {
      if (glucoseValues.length < 2) return 'stable';
      const firstHalf = glucoseValues.slice(0, Math.floor(glucoseValues.length / 2));
      const secondHalf = glucoseValues.slice(Math.floor(glucoseValues.length / 2));
      const avgFirst = firstHalf.reduce((a, b) => a + b, 0) / firstHalf.length;
      const avgSecond = secondHalf.reduce((a, b) => a + b, 0) / secondHalf.length;
      if (avgSecond - avgFirst > 10) return 'rising';
      if (avgFirst - avgSecond > 10) return 'falling';
      return 'stable';
    })();

    // Determine risk level
    const risk = (() => {
      if (avgGlucose > 180 || avgGlucose < 70 || variability > 50) return 'high';
      if (avgGlucose > 160 || avgGlucose < 80 || variability > 30) return 'medium';
      return 'low';
    })();

    return {
      timeOfDay: slot.name,
      avgGlucose,
      variability,
      trend,
      risk
    };
  });
};

// Analyze meal patterns with support for both Carb Announcements and Meal Bolus
export const analyzeMealPatterns = (entries: any[], treatments: any[]): any[] => {
  const timeSlots = [
    { name: 'Breakfast', start: 5, end: 11 }, // Extended breakfast window
    { name: 'Lunch', start: 10, end: 16 },    // Overlapping lunch window
    { name: 'Dinner', start: 15, end: 23 },   // Extended dinner window
    { name: 'Late Night', start: 22, end: 5 } // Late night snacks/meals
  ];

  console.log('🍽️ Starting meal pattern analysis...');

  return timeSlots.map(slot => {
    console.log(`\n📊 Analyzing ${slot.name} period (${slot.start}:00-${slot.end}:00)`);
    
    // Find all meal-related treatments in this time slot
    let slotMeals;
    
    if (slot.name === 'Late Night') {
      // Special handling for late night period that crosses midnight
      const lateNightMeals = findMealTreatments(treatments, 22, 24);
      const earlyMorningMeals = findMealTreatments(treatments, 0, 5);
      slotMeals = [...lateNightMeals, ...earlyMorningMeals];
    } else {
      slotMeals = findMealTreatments(treatments, slot.start, slot.end);
    }

    if (slotMeals.length === 0) {
      console.log(`❌ No meals found for ${slot.name}`);
      return {
        timeOfDay: slot.name,
        avgCarbIntake: 0,
        avgGlucoseResponse: 0,
        insulinSensitivity: 0,
        mealCount: 0,
        mealTypes: { carbAnnouncements: 0, mealBolus: 0, combinedMeals: 0 }
      };
    }

    console.log(`✅ Found ${slotMeals.length} meals for ${slot.name}`);

    // Enhanced insulin calculation for better averages
    const mealsWithEnhancedInsulin = slotMeals.map(meal => {
      if (meal.type === 'carbAnnouncement') {
        // For carb announcements, look for subsequent insulin doses
        const carbTime = new Date(meal.created_at || meal.timestamp || meal.mills).getTime();
        
        const subsequentInsulin = treatments.filter(t => {
          const treatmentTime = new Date(t.created_at || t.timestamp || t.mills).getTime();
          const timeDiff = treatmentTime - carbTime;
          
          // Look for insulin treatments 0-120 minutes after carb announcement
          return timeDiff >= 0 && 
                 timeDiff <= 120 * 60 * 1000 && 
                 t.insulin && 
                 t.insulin > 0 &&
                 (t.eventType === 'Meal Bolus' || 
                  t.eventType === 'Bolus' || 
                  t.eventType === 'Normal Bolus' ||
                  t.eventType === 'Quick Bolus' ||
                  (t.notes && t.notes.toLowerCase().includes('bolus')));
        });
        
        if (subsequentInsulin.length > 0) {
          const totalSubsequentInsulin = subsequentInsulin.reduce((sum, insulin) => sum + (insulin.insulin || 0), 0);
          return {
            ...meal,
            effectiveInsulin: totalSubsequentInsulin,
            insulinSource: 'subsequent',
            subsequentInsulinCount: subsequentInsulin.length
          };
        } else if (meal.correspondingInsulin) {
          return {
            ...meal,
            effectiveInsulin: meal.correspondingInsulin.insulin || 0,
            insulinSource: 'corresponding'
          };
        }
      }
      
      return {
        ...meal,
        effectiveInsulin: meal.insulin || 0,
        insulinSource: 'direct'
      };
    });

    const avgCarbIntake = mealsWithEnhancedInsulin.reduce((acc, meal) => acc + (meal.carbs || 0), 0) / mealsWithEnhancedInsulin.length;
    
    // Calculate average insulin using enhanced tracking
    const avgInsulinIntake = mealsWithEnhancedInsulin.reduce((acc, meal) => acc + (meal.effectiveInsulin || 0), 0) / mealsWithEnhancedInsulin.length;

    // Enhanced statistics for carb announcements
    const carbAnnouncementStats = mealsWithEnhancedInsulin
      .filter(meal => meal.type === 'carbAnnouncement')
      .reduce((stats, meal) => {
        stats.count++;
        stats.totalCarbs += meal.carbs || 0;
        stats.totalInsulin += meal.effectiveInsulin || 0;
        if (meal.insulinSource === 'subsequent') {
          stats.enhancedTrackingCount++;
          stats.enhancedInsulin += meal.effectiveInsulin || 0;
        }
        return stats;
      }, { count: 0, totalCarbs: 0, totalInsulin: 0, enhancedTrackingCount: 0, enhancedInsulin: 0 });

    console.log(`💉 ${slot.name} insulin analysis:`, {
      totalMeals: mealsWithEnhancedInsulin.length,
      avgInsulin: Math.round(avgInsulinIntake * 10) / 10,
      carbAnnouncements: {
        count: carbAnnouncementStats.count,
        avgCarbs: carbAnnouncementStats.count > 0 ? Math.round(carbAnnouncementStats.totalCarbs / carbAnnouncementStats.count) : 0,
        avgInsulin: carbAnnouncementStats.count > 0 ? Math.round((carbAnnouncementStats.totalInsulin / carbAnnouncementStats.count) * 10) / 10 : 0,
        enhancedTracking: carbAnnouncementStats.enhancedTrackingCount,
        enhancedAvgInsulin: carbAnnouncementStats.enhancedTrackingCount > 0 ? 
          Math.round((carbAnnouncementStats.enhancedInsulin / carbAnnouncementStats.enhancedTrackingCount) * 10) / 10 : 0
      }
    });

    // Calculate average glucose response using enhanced meal data
    const glucoseResponses = mealsWithEnhancedInsulin.map(meal => {
      const mealTime = new Date(meal.created_at || meal.timestamp || meal.mills).getTime();
      const postMealReadings = entries.filter(entry => {
        const readingTime = new Date(entry.date).getTime();
        return readingTime > mealTime && readingTime <= mealTime + 2 * 60 * 60 * 1000; // 2 hours post-meal
      });

      if (postMealReadings.length === 0) return 0;

      const preMealReading = entries.find(entry => {
        const readingTime = new Date(entry.date).getTime();
        return readingTime <= mealTime && readingTime > mealTime - 15 * 60 * 1000; // 15 minutes pre-meal
      });

      const maxPostMeal = Math.max(...postMealReadings.map(r => r.sgv));
      return preMealReading ? maxPostMeal - preMealReading.sgv : 0;
    }).filter(response => response > 0);

    const avgGlucoseResponse = glucoseResponses.length > 0 
      ? glucoseResponses.reduce((a, b) => a + b, 0) / glucoseResponses.length 
      : 0;

    // Calculate insulin sensitivity using enhanced insulin tracking
    const mealsWithEffectiveInsulin = mealsWithEnhancedInsulin.filter(meal => meal.effectiveInsulin && meal.effectiveInsulin > 0);
    const insulinSensitivity = mealsWithEffectiveInsulin.length > 0 
      ? mealsWithEffectiveInsulin.reduce((acc, meal) => acc + (avgGlucoseResponse / meal.effectiveInsulin), 0) / mealsWithEffectiveInsulin.length
      : 0;

    // Count meal types
    const mealTypes = slotMeals.reduce((counts, meal) => {
      if (meal.type === 'carbAnnouncement') {
        counts.carbAnnouncements++;
      } else if (meal.type === 'mealBolus') {
        counts.mealBolus++;
      } else if (meal.type === 'combined') {
        counts.combinedMeals++;
      }
      return counts;
    }, { carbAnnouncements: 0, mealBolus: 0, combinedMeals: 0 });

    console.log(`📈 ${slot.name} summary:`, {
      avgCarbIntake: Math.round(avgCarbIntake),
      avgInsulinIntake: Math.round(avgInsulinIntake * 10) / 10,
      avgGlucoseResponse: Math.round(avgGlucoseResponse),
      insulinSensitivity: Math.round(insulinSensitivity),
      mealCount: slotMeals.length,
      mealTypes
    });

    return {
      timeOfDay: slot.name,
      avgCarbIntake: Math.round(avgCarbIntake),
      avgInsulinIntake: Math.round(avgInsulinIntake * 10) / 10,
      avgGlucoseResponse: Math.round(avgGlucoseResponse),
      insulinSensitivity: Math.round(insulinSensitivity),
      mealCount: slotMeals.length,
      mealTypes,
      carbAnnouncementStats: {
        count: carbAnnouncementStats.count,
        avgInsulinAfterAnnouncement: carbAnnouncementStats.count > 0 ? 
          Math.round((carbAnnouncementStats.totalInsulin / carbAnnouncementStats.count) * 10) / 10 : 0,
        enhancedTrackingCount: carbAnnouncementStats.enhancedTrackingCount
      }
    };
  });
};

// Helper function to find meal-related treatments
const findMealTreatments = (treatments: any[], startHour: number, endHour: number): any[] => {
  const mealTreatments: any[] = [];
  
  // Filter treatments by time window
  const timeFilteredTreatments = treatments.filter(treatment => {
    const hour = new Date(treatment.created_at || treatment.timestamp || treatment.mills).getHours();
    return startHour <= hour && hour < endHour;
  });

  console.log(`🍽️ Analyzing ${timeFilteredTreatments.length} treatments between ${startHour}:00-${endHour}:00`);

  // More comprehensive detection of meal-related treatments
  const identifyMealTreatment = (treatment: any) => {
    const eventType = (treatment.eventType || '').toLowerCase();
    const notes = (treatment.notes || '').toLowerCase();
    const hasCarbs = treatment.carbs && treatment.carbs > 0;
    const hasInsulin = treatment.insulin && treatment.insulin > 0;
    
    // Log each treatment for debugging
    console.log(`🔍 Treatment analysis:`, {
      eventType: treatment.eventType,
      notes: treatment.notes,
      carbs: treatment.carbs,
      insulin: treatment.insulin,
      created_at: treatment.created_at
    });

    // Enhanced carb announcement detection
    const isCarbAnnouncement = hasCarbs && (
      // Standard carb event types
      eventType === 'carb correction' ||
      eventType === 'carb' ||
      eventType === 'carbs' ||
      eventType === 'meal' ||
      eventType === 'snack' ||
      eventType === 'carb announcement' ||
      // Meal bolus with carbs but no insulin
      (eventType === 'meal bolus' && !hasInsulin) ||
      // Notes-based detection
      notes.includes('carb') ||
      notes.includes('meal') ||
      notes.includes('eat') ||
      notes.includes('food') ||
      notes.includes('snack') ||
      notes.includes('breakfast') ||
      notes.includes('lunch') ||
      notes.includes('dinner') ||
      // Any treatment with carbs but no insulin (likely announcement)
      (hasCarbs && !hasInsulin)
    );

    // Enhanced meal bolus detection
    const isMealBolus = hasInsulin && (
      eventType === 'meal bolus' ||
      eventType === 'bolus' ||
      eventType === 'normal bolus' ||
      eventType === 'quick bolus' ||
      // Notes-based detection for insulin
      notes.includes('bolus') ||
      notes.includes('insulin') ||
      // Any insulin-only treatment during meal times
      (hasInsulin && !hasCarbs)
    );

    // Combined meal (has both carbs and insulin)
    const isCombinedMeal = hasCarbs && hasInsulin;

    return {
      isCarbAnnouncement,
      isMealBolus,
      isCombinedMeal,
      isMealRelated: isCarbAnnouncement || isMealBolus || isCombinedMeal
    };
  };

  // Group treatments by time proximity (within 45 minutes instead of 30 for better grouping)
  const treatmentGroups: any[][] = [];
  
  timeFilteredTreatments.forEach(treatment => {
    const treatmentTime = new Date(treatment.created_at || treatment.timestamp || treatment.mills).getTime();
    
    // Find existing group within 45 minutes
    const existingGroup = treatmentGroups.find(group => {
      return group.some(t => {
        const groupTime = new Date(t.created_at || t.timestamp || t.mills).getTime();
        return Math.abs(treatmentTime - groupTime) <= 45 * 60 * 1000; // 45 minutes
      });
    });
    
    if (existingGroup) {
      existingGroup.push(treatment);
    } else {
      treatmentGroups.push([treatment]);
    }
  });

  console.log(`📊 Created ${treatmentGroups.length} treatment groups`);

  // Process each group to identify meal patterns
  treatmentGroups.forEach((group, groupIndex) => {
    console.log(`🔍 Processing group ${groupIndex + 1} with ${group.length} treatments`);
    
    const mealAnalysis = group.map(identifyMealTreatment);
    const carbTreatments = group.filter((_, i) => mealAnalysis[i].isCarbAnnouncement);
    const insulinTreatments = group.filter((_, i) => mealAnalysis[i].isMealBolus);
    const combinedMeals = group.filter((_, i) => mealAnalysis[i].isCombinedMeal);

    console.log(`  - Combined meals: ${combinedMeals.length}`);
    console.log(`  - Carb announcements: ${carbTreatments.length}`);
    console.log(`  - Insulin boluses: ${insulinTreatments.length}`);

    // Case 1: Combined meals (carbs + insulin in same treatment)
    combinedMeals.forEach(treatment => {
      mealTreatments.push({
        ...treatment,
        type: 'combined',
        carbs: treatment.carbs,
        insulin: treatment.insulin
      });
      console.log(`✅ Added combined meal: ${treatment.carbs}g carbs, ${treatment.insulin}U insulin`);
    });

    // Case 2: Carb announcements (prioritize these to capture all carb entries)
    carbTreatments.forEach(carbTreatment => {
      // Check if this carb treatment is not already part of a combined meal
      if (!combinedMeals.some(c => c._id === carbTreatment._id || c.mills === carbTreatment.mills)) {
        // Look for corresponding insulin bolus within the group
        const correspondingInsulin = insulinTreatments.find(insulin => {
          const carbTime = new Date(carbTreatment.created_at || carbTreatment.timestamp || carbTreatment.mills).getTime();
          const insulinTime = new Date(insulin.created_at || insulin.timestamp || insulin.mills).getTime();
          return Math.abs(carbTime - insulinTime) <= 60 * 60 * 1000; // Within 1 hour
        });

        mealTreatments.push({
          ...carbTreatment,
          type: 'carbAnnouncement',
          carbs: carbTreatment.carbs,
          insulin: correspondingInsulin ? correspondingInsulin.insulin : 0,
          correspondingInsulin: correspondingInsulin || null
        });
        
        console.log(`✅ Added carb announcement: ${carbTreatment.carbs}g carbs${correspondingInsulin ? ` with ${correspondingInsulin.insulin}U insulin` : ' (no insulin found)'}`);
      }
    });

    // Case 3: Meal boluses without carb announcements
    insulinTreatments.forEach(insulinTreatment => {
      // Check if this insulin is not already accounted for
      const alreadyAccountedFor = mealTreatments.some(meal => 
        (meal.correspondingInsulin && (meal.correspondingInsulin._id === insulinTreatment._id || meal.correspondingInsulin.mills === insulinTreatment.mills)) ||
        meal._id === insulinTreatment._id ||
        meal.mills === insulinTreatment.mills
      ) || combinedMeals.some(c => c._id === insulinTreatment._id || c.mills === insulinTreatment.mills);

      if (!alreadyAccountedFor) {
        // Look for corresponding carb announcement that wasn't already processed
        const correspondingCarb = carbTreatments.find(carb => {
          const carbTime = new Date(carb.created_at || carb.timestamp || carb.mills).getTime();
          const insulinTime = new Date(insulinTreatment.created_at || insulinTreatment.timestamp || insulinTreatment.mills).getTime();
          return Math.abs(carbTime - insulinTime) <= 60 * 60 * 1000; // Within 1 hour
        });

        // Only add if we haven't already processed this as a carb announcement
        if (!correspondingCarb || !mealTreatments.some(meal => 
          meal.type === 'carbAnnouncement' && (meal._id === correspondingCarb._id || meal.mills === correspondingCarb.mills)
        )) {
          mealTreatments.push({
            ...insulinTreatment,
            type: 'mealBolus',
            carbs: correspondingCarb ? correspondingCarb.carbs : 0,
            insulin: insulinTreatment.insulin,
            correspondingCarb: correspondingCarb || null
          });
          
          console.log(`✅ Added meal bolus: ${insulinTreatment.insulin}U insulin${correspondingCarb ? ` with ${correspondingCarb.carbs}g carbs` : ' (no carbs found)'}`);
        }
      }
    });
  });

  console.log(`🎯 Final result: Found ${mealTreatments.length} meal treatments between ${startHour}:00-${endHour}:00`);
  console.log(`   - Combined meals: ${mealTreatments.filter(m => m.type === 'combined').length}`);
  console.log(`   - Carb announcements: ${mealTreatments.filter(m => m.type === 'carbAnnouncement').length}`);
  console.log(`   - Meal boluses: ${mealTreatments.filter(m => m.type === 'mealBolus').length}`);
  
  return mealTreatments;
};

// Identify meal clusters with enhanced insulin tracking for carb announcements
export const identifyMealClusters = (treatments: any[], entries: any[]): any[] => {
  // Get all meal treatments using the same logic as analyzeMealPatterns
  const allMealTreatments = findMealTreatments(treatments, 0, 24);
  
  console.log('🔍 Analyzing meal clusters with enhanced insulin tracking...');
  
  const meals = allMealTreatments.map(treatment => {
    const mealTime = new Date(treatment.created_at || treatment.timestamp || treatment.mills).getTime();
    
    // Find glucose response
    const postMealReadings = entries.filter(entry => {
      const readingTime = new Date(entry.date).getTime();
      return readingTime > mealTime && readingTime <= mealTime + 2 * 60 * 60 * 1000;
    });

    const maxGlucose = postMealReadings.length > 0 
      ? Math.max(...postMealReadings.map(r => r.sgv))
      : 0;

    // Enhanced insulin calculation for carb announcements
    let effectiveInsulin = treatment.insulin || 0;
    let insulinSource = 'direct';
    
    if (treatment.type === 'carbAnnouncement') {
      // For carb announcements, we want to capture ALL insulin given after the announcement
      // Look for insulin treatments within 2 hours after the carb announcement
      const carbTime = new Date(treatment.created_at || treatment.timestamp || treatment.mills).getTime();
      
      const subsequentInsulin = treatments.filter(t => {
        const treatmentTime = new Date(t.created_at || t.timestamp || t.mills).getTime();
        const timeDiff = treatmentTime - carbTime;
        
        // Look for insulin treatments 0-120 minutes after carb announcement
        return timeDiff >= 0 && 
               timeDiff <= 120 * 60 * 1000 && 
               t.insulin && 
               t.insulin > 0 &&
               (t.eventType === 'Meal Bolus' || 
                t.eventType === 'Bolus' || 
                t.eventType === 'Normal Bolus' ||
                t.eventType === 'Quick Bolus' ||
                (t.notes && t.notes.toLowerCase().includes('bolus')));
      });
      
      if (subsequentInsulin.length > 0) {
        // Sum all insulin doses given after this carb announcement
        effectiveInsulin = subsequentInsulin.reduce((sum, insulin) => sum + (insulin.insulin || 0), 0);
        insulinSource = 'subsequent';
        
        console.log(`💉 Enhanced insulin tracking for carb announcement:`, {
          carbs: treatment.carbs,
          originalInsulin: treatment.insulin || 0,
          subsequentInsulinDoses: subsequentInsulin.map(i => ({ 
            insulin: i.insulin, 
            eventType: i.eventType,
            timeDiff: Math.round((new Date(i.created_at || i.timestamp || i.mills).getTime() - carbTime) / (60 * 1000))
          })),
          totalEffectiveInsulin: effectiveInsulin
        });
      } else if (treatment.correspondingInsulin) {
        effectiveInsulin = treatment.correspondingInsulin.insulin || 0;
        insulinSource = 'corresponding';
      }
    }

    const carbInsulinRatio = (treatment.carbs && effectiveInsulin > 0) ? treatment.carbs / effectiveInsulin : 0;

    return {
      carbs: treatment.carbs || 0,
      insulin: effectiveInsulin,
      originalInsulin: treatment.insulin || 0,
      insulinSource,
      maxGlucose,
      carbInsulinRatio,
      time: new Date(treatment.created_at || treatment.timestamp || treatment.mills).getHours(),
      type: treatment.type,
      eventType: treatment.eventType,
      hasCarbs: (treatment.carbs && treatment.carbs > 0),
      hasInsulin: effectiveInsulin > 0,
      // Additional tracking for carb announcements
      isEnhancedInsulinTracking: treatment.type === 'carbAnnouncement' && insulinSource === 'subsequent'
    };
  });

  // Enhanced clustering based on carb amount, insulin presence, and meal type
  const assignCluster = (meal: any) => {
    // Cluster 0: Small meals/snacks (<=30g carbs)
    if (meal.carbs <= 30) return 0;
    // Cluster 1: Medium meals (31-60g carbs)
    if (meal.carbs <= 60) return 1;
    // Cluster 2: Large meals (>60g carbs)
    return 2;
  };

  const clusteredMeals = meals.map(meal => ({
    ...meal,
    cluster: assignCluster(meal)
  }));

  // Enhanced logging with insulin tracking insights
  const enhancedInsulinMeals = clusteredMeals.filter(m => m.isEnhancedInsulinTracking);
  
  console.log('📊 Enhanced meal clustering results:', {
    total: clusteredMeals.length,
    byType: clusteredMeals.reduce((acc, meal) => {
      acc[meal.type] = (acc[meal.type] || 0) + 1;
      return acc;
    }, {} as Record<string, number>),
    byCluster: clusteredMeals.reduce((acc, meal) => {
      acc[meal.cluster] = (acc[meal.cluster] || 0) + 1;
      return acc;
    }, {} as Record<number, number>),
    enhancedInsulinTracking: {
      count: enhancedInsulinMeals.length,
      avgCarbsWithEnhancedInsulin: enhancedInsulinMeals.length > 0 ? 
        Math.round(enhancedInsulinMeals.reduce((sum, m) => sum + m.carbs, 0) / enhancedInsulinMeals.length) : 0,
      avgInsulinWithEnhancedTracking: enhancedInsulinMeals.length > 0 ? 
        Math.round((enhancedInsulinMeals.reduce((sum, m) => sum + m.insulin, 0) / enhancedInsulinMeals.length) * 10) / 10 : 0
    }
  });

  return clusteredMeals;
};