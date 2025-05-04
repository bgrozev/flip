# FliP Flight Planner
FliP is a tool for skydiving, specifically for planning the landing pattern.

You can use it here: https://mustelinae.net/flip

# Disclaimer
This is just a tool and comes with NO GUARANTEES. If you use it, you MUST CRITICALLY evaluate the information it 
provides. Please use common sense and DO NOT trust it blindly. Please read the rest of the document and make sure
you understand how it works and what the limitations are.

# What does FliP do?
FliP models a landing pattern and optionally a manoeuvre (i.e. turn to final), including the effects of wind.
It is meant to be a versatile tool for planning and exploration, so there are many adjustable parameters.

The manouvre can be described by the offset, altitude, and time (as can be extracted by gSwoop for example), or 
a GPS grack recorded with [FlySight](https://flysight.ca) directly.

![Example pattern and manoeuvre with wind correction](https://github.com/bgrozev/flip/blob/main/doc/flip.png?raw=true)


# Why?
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
## Setting up the pattern
Adjust the paraters of your landing pattern under the Pattern tab in the navigation menu on the left. The pattern is shown on
the map as a green line.

## Setting up the manoeuvre
Adjust the manoeuvre settings under the Manoeuvre tab in the navigation menu on the left. The manoeuvre is shown on the
map as a red line.

You can enter the offset, altitude and time manually, use one of the built-in sample GPS tracks, 
or import your own GPS track. 

To use FliP the most effectively for your planning you'll need to load your own FlySight track. Make sure it contains
only your manoeuvre by selecting the portion that you want in FlySight Viewer and using the "Export Track" feature.
It's best to trim the file so it stops at the time of plane out, and does not include the level flight over the ground. 
You can re-position to account for conditions manually. Once a track has been loaded, and optionally adjusted for wind,
 it can be saved locally under Manoeuvre -> My Tracks.

## Target
The location and precice position can be selected under the Target tab in the navigation menu on the left.

The "Set Target" and "Set Target And Heading" buttons can be used to select a location by clicking on the map. 
When setting both the target and direction, the first click will set the taget, and the second click will set
the direction. Note that the direction is reversed, think of it as building your pattern from the ground up.

To quickly change to a different location on the map, you can either select one of the built-in dropzones from the
list, of search from the Search tab. Once a target and direction have been selected, you can save them for easy access
under My Locations.


## Wind
You can adjust the wind settings under the Wind tab in the navigation menu on the left. You can just add wind at altitude 0, which will apply for
all altitudes, or add more rows to specify different winds at different altitudes.

You can use the `Fetch Forecast` button to fetch the current forecast for the current location. When winds are loaded this way changing is disabled to
prevent accidental change; use the `Unlock` button if you need to make adjustments. The source of the forecast (either WindsAloft or OpenMeteo) can be selected 
under the Settings tab.

When wind is added, the resulting path is shown as a solid line. The original track, prior the wind adjustment, is shown as a dashed line.
The original track can be hidden with a setting under the Settings tab.


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

This means we assume the wind affects us instantaneously (we have zero inertia). This is not realistic, but we make that 
assumption while planning anyway. Presumably if the wind shear is strong enough to make a practical difference we 
shouldn't be flying canopies :)

## Density altitude
FliP DOES NOT correct for the elevation of the landing zone or density altitude in any way.

## Correcting for wind
If your track was captured in known, light wind conditions, you can use FliP to cancel out the wind and get a cleaner
sample. To do this load your track, then apply wind as necessary, then export the track.

# Questions
## Is this just for swooping?
No. My primary motivation for creating FliP is to use it myself for canopy piloting training, but I'm also using it
with my students to plan straight-in landings.

## Where does the name FliP come from?
It's my years long setup for a joke. When I have the time to build a Flocking Planner you'll be able to
FliP/FloP between the two.

# Authors and License
FliP is open-source, licensed under the [Apache 2.0 license](./LICENSE.txt). It was created by Boris Grozev.

# Development
See the [BUILD.md](./doc/BUILD.md) file for how to develop or build the application.
