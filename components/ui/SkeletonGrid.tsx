import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Skeleton } from './Skeleton';

interface SkeletonGridProps {
  columns?: number;
  rows?: number;
}

export function SkeletonGrid({ columns = 2, rows = 2 }: SkeletonGridProps) {
  return (
    <View style={styles.grid}>
      {Array.from({ length: rows * columns }).map((_, index) => (
        <View key={index} style={styles.skeletonItem}>
          <Skeleton height={120} borderRadius={12} marginBottom={8} />
          <Skeleton width="80%" height={14} marginBottom={4} />
          <Skeleton width="60%" height={12} />
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  skeletonItem: {
    flex: 1,
    minWidth: '45%',
    padding: 12,
  },
});
