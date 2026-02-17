import { z } from "zod";
import { router, publicProcedure } from "../trpc.js";
import { TRPCError } from "@trpc/server";
import { sendMail, wrap } from "../services/email.js";

export const waitlistRouter = router({
  join: publicProcedure
    .input(
      z.object({
        email: z.string().email(),
        name: z.string().optional(),
        company: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      try {
        await ctx.prisma.waitlist.create({
          data: { email: input.email, name: input.name, company: input.company },
        });
        const count = await ctx.prisma.waitlist.count();
        const position = count + 243;

        // Send welcome email
        try {
          const html = wrap(`
            <h2 style="color:#ffffff;margin:0 0 16px;font-size:24px">You're on the list! 🎉</h2>
            <p style="margin:0 0 12px">Thanks for joining the DKFlow waitlist${input.name ? `, ${input.name}` : ""}!</p>
            <p style="margin:0 0 12px">You're <strong style="color:#818cf8">#${position}</strong> in line. We're building something special — an AI-powered project management platform that replaces Jira, Trello, and Asana.</p>
            <p style="margin:0 0 20px">Here's what you'll get access to:</p>
            <ul style="margin:0 0 20px;padding-left:20px;color:#c4c4d4">
              <li style="margin-bottom:8px">📋 Board, List, Table, Timeline & 6+ views</li>
              <li style="margin-bottom:8px">🤖 18 AI features — auto-triage, smart breakdown, risk prediction</li>
              <li style="margin-bottom:8px">🏃 Agile sprints with burndown & velocity charts</li>
              <li style="margin-bottom:8px">🎯 Goals, OKRs & roadmap tracking</li>
              <li style="margin-bottom:8px">🔐 Enterprise-grade RBAC with 10+ roles</li>
            </ul>
            <p style="margin:0 0 20px">We'll notify you as soon as your spot opens up. Stay tuned!</p>
            <a href="https://dkflow.in" style="display:inline-block;padding:14px 32px;background:linear-gradient(135deg,#6366f1,#a855f7);color:#ffffff;border-radius:8px;text-decoration:none;font-weight:700;font-size:15px">Visit DKFlow →</a>
            <p style="margin:20px 0 0;color:#64748b;font-size:13px">— The DKFlow Team</p>
          `);
          await sendMail(
            input.email,
            `You're #${position} on the DKFlow waitlist! 🚀`,
            html,
          );
        } catch (emailErr) {
          console.error("[Waitlist] Failed to send welcome email:", emailErr);
        }

        return { success: true, count: position };
      } catch (e: any) {
        if (e?.code === "P2002") {
          throw new TRPCError({
            code: "CONFLICT",
            message: "This email is already on the waitlist!",
          });
        }
        throw e;
      }
    }),

  getCount: publicProcedure.query(async ({ ctx }) => {
    const count = await ctx.prisma.waitlist.count();
    return { count: count + 243 };
  }),
});
