export {
  PRE_A1_EXAM_ITEMS_PER_SKILL,
  PRE_A1_EXAM_OVERALL_THRESHOLD,
  PRE_A1_EXAM_SKILL_FLOOR,
  PRE_A1_EXAM_SKILLS,
  PRE_A1_EXAM_TOPIC,
  preA1ExamItemCount,
  type PreA1ExamSkill,
} from "./shape";

export {
  ExamScoreBreakdownSchema,
  PreA1ExamAnswersSchema,
  PreA1ExamFillSchema,
  PreA1ExamItemSchema,
  PreA1ExamSkillSchema,
  TeacherReportRequestSchema,
  type PreA1ExamAnswers,
  type PreA1ExamFill,
  type PreA1ExamItem,
  type TeacherReportRequest,
} from "./schemas";

export {
  scorePreA1Exam,
  type ExamAnswerSelection,
  type ExamScoreBreakdown,
  type SkillScore,
} from "./scoring";

export { buildPreA1ExamFillMessages, fillPreA1Exam } from "./fill";

export { submitPreA1ChapterExam, type SubmitPreA1ExamResult } from "./submit";

export { PRE_A1_CURRICULUM_GUIDE_STUB } from "./guide-stub";

export {
  PRE_A1_EXAM_REPORT_TOPIC,
  TeacherReportSchema,
  buildPreA1TeacherReportMessages,
  generatePreA1TeacherReport,
  type TeacherReport,
  type TeacherReportContext,
} from "./teacher-report";

export { persistPreA1ExamTeacherReport } from "./persist-report";
