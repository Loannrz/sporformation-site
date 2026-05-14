/** Sélection SQL commune pour une ligne `sanctions` (PDF + hub admin). */
export const SANCTION_TABLE_ROW_SELECT =
  "id,student_id,type,occurred_at,description,title,author_id,status,retired_at,retired_by,pdf_path,created_at" as const;
