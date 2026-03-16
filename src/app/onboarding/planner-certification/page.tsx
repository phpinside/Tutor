import { redirect } from 'next/navigation'
import { getCurrentTeacherLearningPlannerApplication } from '@/app/actions/learningPlanner'
import { extractQiniuKey, generatePrivateUrl } from '@/lib/qiniu'
import PlannerCertificationClient from './PlannerCertificationClient'

export const dynamic = 'force-dynamic'

export default async function PlannerCertificationPage() {
  const result = await getCurrentTeacherLearningPlannerApplication()

  if (!result.success || !result.teacher) {
    redirect('/auth/login?redirect=/onboarding/planner-certification')
  }

  if (!result.isEligible) {
    redirect('/onboarding/complete')
  }

  const application = result.application
    ? {
        ...result.application,
        signedStudyPlanPdfUrl: generatePrivateUrl(
          extractQiniuKey(result.application.studyPlanPdfUrl)
        ),
        reviews: result.application.reviews.map((review) => {
          const imageUrls: string[] = (review as unknown as { imageUrls: string[] }).imageUrls ?? []
          return {
            ...review,
            signedImageUrls: imageUrls.map((url) =>
              generatePrivateUrl(extractQiniuKey(url))
            ),
          }
        }),
      }
    : null

  return (
    <PlannerCertificationClient
      teacherId={result.teacher.id}
      teacherName={result.teacher.name}
      application={application}
    />
  )
}
