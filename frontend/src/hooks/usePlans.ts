import { useQuery } from '@tanstack/react-query'
import { fetchPlans, planKeys } from '../api/plans.ts'
import { useAreas } from '../areas/useAreas.ts'

/** 計画ごとの進み具合（選んでいるエリアのステップだけで集計する） */
export function usePlans() {
  const { areaId } = useAreas()
  return useQuery({
    queryKey: planKeys.list(areaId),
    queryFn: () => fetchPlans(areaId),
  })
}
