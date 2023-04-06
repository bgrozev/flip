# FliP Flight Planner
FliP is a tool for skydiving, specifically for planning the landing pattern.

# Disclaimer
This is just a tool and comes with NO GUARANTEES. If you use it, you MUST CRITICALLY evaluate the information it 
provides. Please use common sense and DO NOT trust it blindly. Please read the rest of the document and make sure
you understand how it works and what the limitations are.

# What does FliP do?
The basic idea is to load a GPS track recorded with [FlySight](https://flysight.ca) and manipulate it to move it
to a desired location and account for winds.

![Example track with added wind](https://github.com/bgrozev/flip/blob/main/doc/flip.png?raw=true)


We usually plan our pattern manually based on 2 or 3 points in the pattern, approximate glide ratio, and a rough
estimation of the winds. The problems with this approach are:

* It's a laborious process if you do it in detail.
* It uses only 2-3 points, and doesn't take into account how we fly e.g. the turn to base or the manoeuvre itself.
* It's hard to account for wind at different altitudes.

FliP solves these problems, but there are limitations and disadvantages:
* The wind adjustments are only as good as the wind forecast.
* It requires a sample FlySight file, ideally recorded in very light wind conditions.

FliP is designed to be used in conjunction with FlySight/FlySight Viewer, gSwoop, WindsAloft, etc and not to replace
any of them. 

# How to use
To use FliP effectively for your planning you'll need to load your own FlySight track (see the section below for
details). But there are a few built-in samples that you can play with.

## Selecting a track
You can select a track under the `Tracks` menu. There are 4 built-in samples you can play with. You can also import
a track from a FlySight file (see [#Preparing and importing a FlySight file]). After a track is imported, you can name
it and save it in the application with the `save` button. 

Note that tracks are saved in the browser's `localStorage` and will not be available on other devices. You should 
organize and save the files on your own, and only save them in FliP for convenience.

## Positioning
Under the `Positioning` menu you can move the track to a preset location, further adjust the position with an
offset N/S or E/W, rotate or mirror it. There are a set of built-in locations, but you can save your own under
the `Custom Locations` menu.

## Adding wind
You can adjust the wind settings under the `Wind` menu. You can just add wind at altitude 0, which will apply for
all altitudes, or add more rows to specify different winds at different altitudes.

You can use the `Fetch WindsAloft` button to fetch the current forecast for the current location from 
[WindsAloft](https://www.markschulze.net/winds/). When winds are loaded this way changing the settings is disabled to
prevent accidental change; use the `Unlock` button if you need to make adjustments.

When wind is added the track, the resulting track is shown in green. The original, re-positioned track is shown in red.
The original track can be hidden with a setting under the `Display` menu.


# How FliP works
All operations that FliP applies to a track are centered around the *final* point. Because of that correct trimming of
the file is essential to get meaningful results. 

Repositioning is straightforward, but there are some subtleties when adding wind. 

## Altitudes
FliP ignores the absolute value of the elevation contained in the FlySight file. It assumes that the final point is at
altitude 0, and all other points are relative to it. 

The altitude specified for the wind is in feet AGL.

## Applying wind
Wind is applied starting from the final point (which is kept in place). Each subsequent point is offset from the 
previous point based on:
* Its relative position to the previous point.
* The wind at the given altitude (the altitude of the first of the two points).
* The time difference between the two points.

This means we assume the wind affects us instantaneously (we have inertia). This is not realistic, but we make that 
assumption while planning anyway. Presumably if the wind shear is strong enough to make a practical difference we 
shouldn't be flying canopies :)

## Exporting a track
You can export a track under the `Tracks` menu. The track that is exported is the one with both re-positioning and
wind applied.

Note that when exporting a sample FliP only replaces the latitude and longitude fields in the CSV file. It does not
change anything else. This means that the altitude, horizontal speed, glide ratio, etc are no longer correct in the 
exported file, though it can still be opened in FlySight Viewer or other software. The only reason to export a file
should be to save it for later use in FliP. 

## Density altitude
FliP DOES NOT correct for the elevation of the landing zone or density altitude in any way.

# Preparing and importing a FlySight file
FlySight saves files in a CSV format, which can be edited with a text editor. For best results, tracks should be 
prepared manually before use in FliP.

## Trimming
By trimming we mean removing the extra data from the file, only leaving the data points between two desired points (an
initial and a final point). The easiest way to do it is to use FlySight Viewer to find and note the timestamps of the
two points, then use a text editor to remove the extra lines from the file.
### Selecting the initial point
The initial point is just the pattern entry point. Remove any lines before that point, leaving the first two lines in
place.
### Selecting the final point
How to choose the final point is up to you, and how to indent to use FliP. The point you touch the ground or stop moving
is a poor choice, because wind will be applied relative to it. I tend to use a point a few feet high just prior to 
planing out.

Remove all lines from the file after the final point.
### Auto trim
The autotrim function selects the first point that is 10 ft or higher relative to the final point in the file as the
final point. It cuts off at 2500 ft. It's experimental and I recommend trimming the file manually, so you can understand
exactly what the results mean.

## Adding POMs
POMs (for Point Of Manoeuvre) are points that are visualized with a larged circle. They are useful to keep track of
where the manoeuvre point actually is when wind is applied. They can be hidden with a setting under the `Display` menu.

I like to add POMs for the start of my turn to base, the initiation point of my turn, and my "snap point". 

To add POMs to a file:
1. Add `,POM` to the end of the first line in the file (this adds a new column, called `POM`).
2. Find the point you want to add in FlySight Viewer and note their timestamp.
3. Find the corresponding lines in the file an add `,1` to the end.

FlySight Viewer and other software is designed to ignore extra columns so the files continue to be readable.

## Correcting for wind
If your track was captured in known, light wind conditions, you can use FliP to cancel out the wind and get a cleaner
sample. To do this load your track, then apply wind as necessary, then export the track.

## The built-in samples
There are 4 built-in samples, intended to illustrate different ways to use FliP. Obviously you should not use the 
samples for your own planning.

### [1] Sample-450 
This is an unmodified sample (other than trimming) from a 450 degree turn on a high performance canopy in light wind
conditions. 

### [2] Sample-450, corrected
This is the first sample manually corrected to remove the wind.

### [3] Sample straight-in
This is a sample straight-in approach on a typical 9-cell 150 sqft canopy. It has been trimmed to the start of the
flare, and manually positioned and corrected for wind.

### [4] Sample straight-in, reduced
This is the previous sample, reduce to just 4 points: entry, turn to base, turn to final, flare entry.

# Questions
## Is this just for swooping?
No. My primary motivation for creating FliP is to use it myself for canopy piloting training, but it can be used
with straight-in landings too.

## The user interface sucks. What is this, 2003?
Yep. I have plans to improve things, but working on the UI is zero fun for me, so I've back-burnered them to focus
on functionality. If building UIs is your thing and you want to help reach out or just open PRs.

## Where does the name FliP come from?
It's my months or years long setup for a joke. When I have the time to build a Flocking Planner you'll be able to
FliP/FloP between the two.

# License
FliP is open-source, licensed under the [Apache 2.0 license](./LICENSE.txt).

# Development
See the [BUILD.md](./doc/BUILD.md) file for how to develop or build the application.
