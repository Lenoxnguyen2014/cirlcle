// src/cron/flightMonitorCron.ts
import cron from 'node-cron';
import { MonitorTaskModel } from '../models/monitorTask.ts';
import { searchFlights } from '../services/searchFlight.ts';
import { executeCircleBooking } from '../services/purchaseFlight.ts';
import { evaluateFlightBookingWithAI } from '../services/aiDecisionService.ts';

export function startFlightMonitorCron() {
  // Runs every hour
  cron.schedule('0 * * * *', async () => {
    try {
      // 1. Fetch active monitoring tasks stored in Supabase
      const tasks = await MonitorTaskModel.findActive();

      if (tasks.length === 0) {
        return;
      }

      console.log(`[Cron] Waking up to process ${tasks.length} active monitor task(s)...`);

      // 2. Loop through each stored task dynamically
      for (const task of tasks) {
    
        // Fetch flights for this task's origin/destination/date
        const flights = await searchFlights(task.origin, task.destination, task.date);

        // Evaluate flights using Gemini AI with the saved user instruction
        const decision = await evaluateFlightBookingWithAI(flights, task.userInstruction);

        // Execute Circle payment if conditions are met
        if (decision.shouldBook && decision.selectedFlightId) {
          const selectedFlight = flights.find((f: any) => f.id === decision.selectedFlightId);

          console.log(`Criteria met! Booking flight ${decision.selectedFlightId}...`);
          await executeCircleBooking(decision.selectedFlightId, selectedFlight?.priceUsdc);

          // 3. Mark task as inactive in Supabase so it won't book again
          await MonitorTaskModel.deactivate(task.id);
          console.log(`Task [${task.id}] marked inactive.`);
        }
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown cron error';
      console.error('[Cron Error]:', message);
    }
  });
}