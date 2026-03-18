# SendLog - Climbing Notes User Manual

## Table of Contents
1. [Introduction](#introduction)
2. [Main Features](#main-features)
3. [Getting Started](#getting-started)
4. [Logging Climbs](#logging-climbs)
5. [Project Tracking](#project-tracking)
6. [Route Types](#route-types)
7. [Statistics and Progress Analysis](#statistics-and-progress-analysis)
8. [Voice Notes](#voice-notes)
9. [Sharing Your Achievements](#sharing-your-achievements)
10. [Data Management](#data-management)
11. [Settings and Preferences](#settings-and-preferences)

## Introduction

SendLog (ClimbingNotes) is an iOS app designed specifically for climbers to log, track, and analyze their climbing achievements. Whether you're documenting sent routes, working on projects, or tracking your progress over time, SendLog provides all the tools you need to enhance your climbing journey.

## Main Features

1. **Climbing Log Management**: Record details of routes you've successfully climbed
2. **Repeat Ascent Tracking**: Log and manage multiple ascents of the same route with full history
3. **Project Tracking**: Track progress on routes you're working on
4. **Statistics and Analytics**: Visualize your climbing progress and achievements with unique vs total climb analysis
5. **Voice Notes**: Use speech recognition to easily record notes about your climbs
6. **Sharing Features**: Generate custom cards to share your achievements
7. **Grade System Support**: Choose between multiple grade systems (French, UIAA, YDS)
8. **Enhanced Data Import/Export**: Complete backup and restore including all repeat ascent data
9. **Personalized Settings**: Customize the app to your preferences
10. **Climbing Days Tracking**: Monitor and visualize your climbing frequency across different time periods

## Getting Started

### Interface Overview

1. When you first open SendLog, you'll land on the main tab interface
2. The app consists of four main tabs:
   - **SendLogs**: View your completed climbs
   - **Projects**: Track routes you're working on
   - **Statistics**: Analyze your climbing data
   - **Settings**: Customize your preferences
3. To start logging your climbing achievements, navigate to the SendLogs tab and tap the "+" button

## Logging Climbs

### Recording a Send

1. From the SendLogs tab, tap the "+" button to create a new entry in a modern overlay interface
2. Fill in the route details in the streamlined form:
   - **Area**: The general climbing location (e.g., "Yosemite")
   - **Crag**: The specific wall or sector (e.g., "El Capitan")
   - **Route**: The name of the climb
   - **Grade**: Select the difficulty from the grade picker
   - **Send Type**: Choose how you completed the route (onsight, flash, redpoint, etc.)
   - **Route Type**: Select the type of route (Sport, Boulder, or Multi-Pitch)
   - **Rating**: Your personal rating of the route (1-5 stars)
   - **Date**: When you completed the climb
   - **Notes**: Any additional information you want to remember
3. Tap "Save" to add the climb to your log
4. Use the "X" button in the top-right corner to cancel and close the overlay

### Viewing and Editing Logs

1. All your sends appear chronologically in the SendLogs tab
2. Tap on any entry to view its details in a full-screen detail view
3. In detail view, you can:
   - See all information about your climb
   - Edit any fields by tapping the "Edit" button (opens a consistent overlay interface)
   - Delete the log if needed (with confirmation)
4. The editing overlay has the same consistent appearance and layout as the creation overlay

### Managing Repeat Ascents (New!)

SendLog now supports comprehensive repeat ascent tracking for routes you've climbed multiple times:

**Viewing Ascent History:**
1. From the route detail view, scroll down to see the "Ascent History" section
2. View all your ascents of this route in chronological order
3. Each ascent shows the date, send type, and any notes you've added
4. The original send is marked as "(First Send)" with accent color
5. Subsequent climbs are marked as "(Repeat)" with secondary color

**Adding Repeat Ascents:**
1. In the route detail view, tap "Add Repeat Ascent"
2. Fill in the ascent details in the overlay:
   - **Date**: When you repeated the route
   - **Send Type**: How you climbed it this time (may be different from original)
   - **Notes**: Specific details about this ascent
3. Tap "Save" to add the repeat ascent
4. **Improved Navigation**: You'll remain in the detail view to see your new ascent and can add more if needed

**Managing Ascents:**
1. Tap on any ascent in the history to edit its details
2. Use swipe-to-delete to remove incorrect ascent entries
3. All changes maintain the route's ascent history integrity

**Statistics Integration:**
- Repeat ascents are included in your climbing statistics when using "All Climbs (Including Repeats)" mode
- Use the toggle in Statistics to choose between unique routes or total climbs including repeats
- Climbing days calculation includes days when you only did repeat ascents

### Filtering and Searching

- Use the search field to find specific entries by name, area, or crag
- Use the filter menus at the top of the SendLogs tab to narrow down your climbing logs:
  
  - **Area Filter**: Tap "Filter by Area" to select a specific climbing location
  - **Route Type Filter**: Tap "Filter by Route Type" to view only Sport, Boulder, or Multi-Pitch routes
  - **Interactive Filtering**: When you select a route type, the area filter automatically updates to show only areas with that type of climb. Similarly, when you select an area, the route type filter shows only types available in that area.
  - **Clear Filters**: Select "All Areas" or "All Route Types" to remove those filters

- Combine both filters to quickly find specific climbs (e.g., all boulder problems in a specific area)
- The filters work together - if you select an area that has no boulders, the boulder option won't appear in the route type filter

## Project Tracking

### Adding a New Project

1. Navigate to the Projects tab
2. Tap the "+" button to add a new project in the modern overlay interface
3. Fill in the route details using the same consistent form layout as SendLog creation
4. The route will automatically be marked with "active" status
5. Use the "X" button to cancel or "Save" to create the project

### Logging Attempts

1. From the Projects tab, select a project
2. Tap "Log Attempt" to record a new attempt
3. For each attempt, you can record:
   - Date of the attempt
   - High point reached
   - Detailed notes about what worked or didn't work
   - Whether you successfully completed the route

### Project Management

Projects are organized into three categories:
1. **Active Projects**: Routes you're currently working on
2. **Completed Projects**: Projects you've successfully sent
3. **Abandoned Projects**: Projects you've decided to put aside

When you complete a project:
1. Log your final successful attempt
2. Mark "Was Successful" during attempt logging
3. The project will automatically move to the "Completed" section and be added to your SendLogs

**Important: Deleting Completed Projects**
- When you delete a **completed project**, you're also deleting the associated send log and all repeat ascent history
- The app will warn you with: *"This will permanently delete the project and its send log, including all ascent history. This action cannot be undone."*
- For active or abandoned projects, deletion only removes the project without affecting send logs
- This enhanced warning helps prevent accidental loss of your climbing achievements

## Route Types

SendLog allows you to categorize your climbs based on their type, providing better organization and more detailed statistics.

### Route Type Categories

The app supports three main route types:

1. **Sport**: Traditional single-pitch sport climbing routes with bolted protection
2. **Boulder**: Boulder problems that don't require a rope
3. **Multi-Pitch**: Routes with multiple pitches, typically requiring longer climbing sessions

### Setting Route Types

When adding or editing a climb entry:

1. Look for the "Route Type" dropdown menu
2. Select the appropriate route type (Sport, Boulder, or Multi-Pitch)
3. The default selection is "Sport" for new entries

### Visual Indicators

Different route types are color-coded throughout the app for easy identification:
- **Sport**: Blue indicators
- **Boulder**: Orange indicators
- **Multi-Pitch**: Purple indicators

These visual indicators appear in:
- SendLog lists
- Project lists
- Detail views
- Statistics charts

### Filtering by Route Type

Your route type selections help you:
1. Quickly identify different types of climbs in your lists
2. See your distribution of climbing activities in the Statistics tab
3. Share more detailed information when posting your achievements

## Statistics and Progress Analysis

The Statistics tab provides comprehensive insights into your climbing journey with advanced metrics that distinguish between unique route achievements and total climbing activity.

### Overview

The enhanced Statistics tab now offers two viewing modes to help you understand different aspects of your climbing:

1. **Unique Routes Focus**: Track your progression and route exploration
2. **Total Activity Focus**: Monitor your climbing volume and training consistency

### Statistics Viewing Modes

#### Toggle Between Views

At the top of the Statistics tab, you'll find a toggle switch that lets you choose between:

- **"Unique Routes Only"**: Statistics based on the first time you climbed each route
- **"All Climbs (Including Repeats)"**: Statistics including repeat ascents and total climbing activity

#### Understanding Each Mode

**Unique Routes Only Mode:**
- Focuses on your route achievements and exploration
- Shows progression to new grades and areas
- Excludes repeat ascents from most calculations
- Best for tracking personal bests and climbing development

**All Climbs (Including Repeats) Mode:**
- Shows your complete climbing activity and training volume
- Includes all ascents: first sends and repeat climbs
- Provides insights into climbing frequency and consistency
- Best for understanding your overall climbing practice

### Key Statistics Explained

1. **Summary Statistics**:
   - **Unique Routes**: Number of different routes you've successfully climbed
   - **Total Climbs**: Complete climbing count including repeat ascents
   - **Repeat Rate**: Percentage of your climbs that are repeat ascents
   - **Average Route Rating**: Your average personal rating of climbed routes
   - **Top Climbing Area**: Most frequently visited climbing location
   - **Highest Grade Achieved**: Your personal best grade
   - **Unique Climbing Days**: Days when you climbed at least once (includes repeat-only days)
   - **Average Climbs per Day**: Total climbs divided by climbing days

2. **Grade Distribution Chart**:
   - Visual representation of climbs across different grades
   - Updates based on your selected viewing mode (unique vs total)
   - Track your progression and frequency at each difficulty level
   - Includes expanded grade range (French 3b-10b, UIAA 3-14, YDS 5.3-5.16c)

3. **Route Type Distribution**:
   - Shows distribution across Sport, Boulder, and Multi-Pitch routes
   - Color-coded chart reflecting your selected viewing mode
   - Updates to show either unique routes or total climbs

4. **Top Grade Tracking**:
   - Automatically identifies your highest sent grade
   - Only includes successfully completed climbs (not projects)
   - Reflects your personal best achievement

5. **Climbing Frequency Analysis**:
   - Calendar heatmap visualizing your climbing days
   - Includes days with repeat ascents
   - Identify patterns in your climbing schedule
   - Track consistency over time

### Getting Help

Tap the "?" button in the Statistics tab to access the help screen, which explains:
- The difference between viewing modes
- How each metric is calculated
- What each statistic means for your climbing progress

### Time Period Filtering

The Statistics View allows you to filter data by time period:

1. At the top of the Statistics tab, select your desired time period:
   - Week
   - Month  
   - Year
   - Custom date range
   - All time
2. All statistics and visualizations will update to reflect data from that period only
3. Works with both viewing modes (unique routes and total climbs)
4. Compare performance across different time frames
5. Track your progress over specific intervals

1. At the top of the Statistics tab, select your desired time period
2. All statistics and visualizations will update to reflect data from that period only
3. Compare performance across different time frames
4. Track your progress over specific intervals

### Calendar Heatmap

The calendar heatmap provides a visual representation of your climbing frequency:

1. Each cell represents a day, with color intensity indicating climbing activity
2. Darker colors represent more climbs on a given day (including repeats)
3. Shows all climbing days, including days with only repeat ascents
4. Hover over any cell to see details about that day's climbs
5. Identify patterns in your climbing schedule
6. Track your consistency over weeks and months

### Repeat Ascent Statistics

SendLog now provides advanced statistics that distinguish between unique routes climbed and total climbing activity including repeat ascents.

#### Understanding the Statistics Modes

The Statistics tab includes a toggle that allows you to view your data in two different ways:

1. **Unique Routes Only**: Shows statistics based on the first time you successfully climbed each route
   - Focuses on your route achievements and exploration
   - Excludes repeat ascents from most calculations
   - Best for tracking your progression to new grades and areas

2. **All Climbs (Including Repeats)**: Shows statistics based on your total climbing activity
   - Includes all ascents: first sends and repeat climbs
   - Provides insight into your overall climbing volume and training
   - Shows your complete climbing activity and frequency

#### Key Metrics Explained

**Unique Routes**: The number of different routes you've successfully climbed
**Total Climbs**: Your complete climbing count including repeat ascents
**Repeat Rate**: The percentage of your climbs that are repeat ascents
**Climbing Days**: Unique days when you climbed (includes days with only repeat ascents)
**Average Climbs per Day**: Your total climbs divided by climbing days

#### Using the Statistics Toggle

1. At the top of the Statistics tab, you'll see a toggle switch
2. Tap to switch between "Unique Routes Only" and "All Climbs (Including Repeats)"
3. All displayed statistics will update to reflect your selected view
4. The toggle setting is remembered between app sessions

#### Help and Explanations

- Tap the "?" button in the Statistics tab to access detailed explanations
- The help screen explains the difference between viewing modes
- Learn how each metric is calculated and what it means for your climbing

#### Why Both Views Matter

- **Unique Routes mode** helps you track your climbing progression and route exploration
- **All Climbs mode** shows your training volume and climbing consistency
- Together, they provide a complete picture of both your achievements and your climbing practice

### Repeat Ascent Logging

#### Adding Repeat Ascents

For routes you've already logged as completed climbs, you can now track additional ascents using the streamlined overlay interface:

1. Navigate to any completed climb in your SendLogs
2. In the route details, scroll to the "Ascent History" section
3. Tap "Add Repeat Ascent" to log another attempt on the same route
4. Fill in the details in the consistent overlay form:
   - **Date**: When you climbed the route again
   - **Send Type**: How you completed it (may differ from your first send)
   - **Notes**: Any specific details about this ascent
5. Tap "Save" to add the repeat ascent or "X" to cancel

#### Managing Ascent History

1. **View All Ascents**: The ascent history shows chronological list of all your attempts
2. **First Send Marking**: Your original send is clearly marked with "(First Send)" 
3. **Repeat Marking**: Additional ascents are marked with "(Repeat)"
4. **Edit/Delete**: Tap any ascent to edit details in the consistent overlay interface or remove it
5. **Send Type Icons**: Each ascent shows appropriate icons for the send type used
6. **Consistent Experience**: All editing uses the same modern overlay interface with identical styling

#### Visual Organization

- **Chronological Order**: All ascents are displayed from newest to oldest
- **Color Coding**: First sends and repeats use different accent colors
- **Send Type Icons**: Consistent iconography shows how each ascent was completed
- **Date Display**: Clear date formatting shows when each ascent occurred

## Voice Notes

### Recording Voice Notes

1. When adding or editing a climb log in the overlay interface, tap the microphone icon
2. Start speaking to record your thoughts
3. The speech recognition system will convert your voice to text
4. Review and edit the transcribed text before saving
5. All voice note functionality is fully integrated into the modern overlay editing system

### Language Support

Configure your preferred language for speech recognition in Settings:
- English
- German
- French
- Spanish

## Sharing Your Achievements

### Creating Share Cards

1. Navigate to any climb in your SendLog list
2. Tap the "Share" button
3. The app will generate a visually appealing card featuring:
   - Route name and grade
   - Climbing area
   - Send type with appropriate icon
   - Route type (Sport, Boulder, or Multi-Pitch)
   - Date of completion
   - Your personal rating
   - Custom background

### Sharing Options

Once your share card is generated:
1. Save the image to your photo library
2. Share directly to social media platforms
3. Send via messaging apps

## Data Management

### Enhanced Export/Import System (New!)

SendLog now features a comprehensive export/import system that preserves all your climbing data including repeat ascents and detailed climbing history.

### Exporting Your Data

1. Go to Settings → Export SendLogs
2. The app will create a ZIP archive containing all your climbing data in enhanced CSV format
   - **Complete Data**: Includes all route details, repeat ascents, and climbing history
   - **Enhanced Format**: New format includes ascent type marking (FirstSend vs Repeat)
   - **Backward Compatible**: Files can be imported by older versions of the app
   - **Ascent Data**: Each repeat ascent is exported with its own date, send type, and notes
3. Choose where to save or share the export file
4. A progress indicator will show the export status

### Importing Data

1. Go to Settings → Import SendLogs
2. Select a previously exported ZIP file
3. The app automatically detects file format:
   - **Legacy Format**: Files from older versions import seamlessly
   - **Enhanced Format**: New files with repeat ascent data are fully restored
4. The app will validate the file format and show import progress
5. All data including repeat ascents will be recreated with proper relationships

**Import Features:**
- **Automatic Format Detection**: Seamlessly handles both old and new export formats
- **Data Preservation**: Zero data loss - all climbing history including repeats is restored
- **Error Handling**: Robust validation with detailed error messages
- **Progress Reporting**: Shows count of imported routes and ascents
- **Data Validation**: Ensures data integrity and handles corrupted files gracefully

**What's Included in Enhanced Exports:**
- All route information (name, area, crag, grade, etc.)
- Original send logs with complete details
- All repeat ascents with individual dates, send types, and notes
- Project information and attempt history
- Statistics-ready data for comprehensive analysis

**Backward Compatibility Guarantee:**
- Files exported from older versions continue to work perfectly
- Enhanced exports can be imported by newer versions for full feature access
- No data loss during version transitions

## Settings and Preferences

### Grade System

Choose your preferred climbing grade system:
1. French (3b to 10b) - Now with expanded lower grade range
2. UIAA (3 to 14) - Now with expanded lower grade range
3. YDS (5.3 to 5.16c) - Now with expanded lower grade range

### Speech Recognition

Select your preferred language for voice notes:
- English
- German
- French
- Spanish

### Data Management

Access options for:
- Exporting your climbing logs
- Importing previously exported data
- Managing backup files

---

**Last Updated:** June 27, 2025