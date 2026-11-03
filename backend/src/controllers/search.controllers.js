import { Student } from "../models/student.models.js";
import { Professor } from "../models/professor.models.js";
import { Batch } from "../models/batch.models.js";
import { Exam } from "../models/exam.models.js";

/**
 * Role-based search rules:
 *   Admin/Auditor → can search students, professors, batches, exams
 *   Professor → can search their own batches and exams
 *   Student   → can search exams
 */
export const globalSearch = async (req, res) => {
    try {
        const role = req.userRole; // set by verifyAnyJWT middleware
        const { q } = req.query;
        if (!q || q.trim() === "") {
            return res.status(200).json({ students: [], professors: [], batches: [], exams: [] });
        }

        const regex = new RegExp(q, "i");

        let students = [], professors = [], batches = [], exams = [];

        if (role === "Admin" || role === "Auditor") {
            [students, professors, batches, exams] = await Promise.all([
                Student.find({ $text: { $search: q } })
                    .select("name email studentId department program batch")
                    .limit(10).lean(),
                Professor.find({ $text: { $search: q } })
                    .select("name email contact")
                    .limit(10).lean(),
                Batch.find({ $text: { $search: q } })
                    .select("title subject status")
                    .limit(10).lean(),
                Exam.find({ $text: { $search: q } })
                    .select("title subject status")
                    .limit(10).lean()
            ]);
        } else if (role === "Professor") {
            [batches, exams] = await Promise.all([
                Batch.find({
                    createdBy: req.user._id,
                    $text: { $search: q }
                }).select("title subject status").limit(10).lean()
            ]);
        } else if (role === "Student") {
            // Students can only discover non-draft exams (Live, Scheduled, Completed)
            exams = await Exam.find({
                $text: { $search: q },
                status: { $in: ["Live", "Scheduled", "Completed"] }
            }).select("title subject status").limit(10).lean();
        }

        res.status(200).json({ students, professors, batches, exams });
    } catch (error) {
        console.error("Global search error:", error);
        res.status(500).json({ message: "Internal server error during search" });
    }
};
