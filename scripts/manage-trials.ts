import { 
  processTrialReminders, 
  processExpiredTrials 
} from "../lib/trials";

async function manageTrials() {
  try {
    console.log("Processing trial reminders...");
    await processTrialReminders();
    console.log("Trial reminders processed successfully.");
    
    console.log("Processing expired trials...");
    await processExpiredTrials();
    console.log("Expired trials processed successfully.");
  } catch (error) {
    console.error("Trial management error:", error);
    process.exit(1);
  }
}

// Execute the trial management process
manageTrials()
  .then(() => {
    console.log("Trial management completed successfully.");
    process.exit(0);
  })
  .catch((error) => {
    console.error("Uncaught error in trial management:", error);
    process.exit(1);
  }); 