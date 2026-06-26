import 'dotenv/config';
import dns from 'dns';
import mongoose from 'mongoose';
import competitorIntelligenceServiceInstance from '../services/competitorIntelligence.service.js';
import CompetitorAnalysis from '../models/competitorAnalysis.model.js';
import User from '../models/user.model.js';

// Apply Windows DNS SRV resolution workaround
dns.setDefaultResultOrder('ipv4first');
dns.setServers(['8.8.8.8', '8.8.4.4']);

async function runTest() {
  try {
    console.log('Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('MongoDB connected.');

    // Find any user to run the analysis for
    const user = await User.findOne({});
    if (!user) {
      console.log('No user found in database. Cannot run analysis test.');
      await mongoose.connection.close();
      return;
    }
    const userId = user._id;
    console.log(`Using User ID: ${userId} (${user.email})`);

    // 1. Test Competitor Detection
    console.log('\n--- Testing Competitor Detection ---');
    const detectResult = await competitorIntelligenceServiceInstance.detectCompetitors(userId);
    console.log('Detection Success:', detectResult.success);
    console.log('Competitors Found:', JSON.stringify(detectResult.competitors, null, 2));

    if (!detectResult.success || detectResult.competitors.length === 0) {
      console.log('Competitor detection failed. Exiting test.');
      await mongoose.connection.close();
      return;
    }

    // 2. Test Competitor Analysis record creation and execution
    console.log('\n--- Creating Competitor Analysis Job ---');
    const analysisRecord = await CompetitorAnalysis.create({
      user: userId,
      status: 'pending',
      targetCompetitors: detectResult.competitors
    });
    console.log(`Analysis record created with ID: ${analysisRecord._id}`);

    console.log('Running analysis pipeline (Website scraping + Claude Sonnet generation + PDF/DOCX generation)...');
    await competitorIntelligenceServiceInstance.runFullAnalysis(analysisRecord._id);

    console.log('\n--- Checking Final Status ---');
    const finalRecord = await CompetitorAnalysis.findById(analysisRecord._id);
    console.log('Final Status:', finalRecord.status);
    console.log('Model Used:', finalRecord.modelUsed);
    console.log('PDF URL:', finalRecord.pdfReportUrl);
    console.log('DOCX URL:', finalRecord.docxReportUrl);
    
    if (finalRecord.status === 'completed') {
      console.log('SUCCESS: Competitor Intelligence analysis generated successfully using Claude Sonnet!');
    } else {
      console.log('FAILED: Analysis status is not completed. Error:', finalRecord.error);
    }

    // Clean up test record
    await CompetitorAnalysis.deleteOne({ _id: analysisRecord._id });
    console.log('Cleaned up test analysis record.');

    await mongoose.connection.close();
    console.log('Database connection closed.');
  } catch (err) {
    console.error('Test execution failed:', err);
    try {
      await mongoose.connection.close();
    } catch (e) {}
  }
}

runTest();
