import {
    Facebook as FacebookIcon,
    FavoriteSharp as FavoriteIcon,
    GitHub as GitHubIcon,
    Instagram as InstagramIcon
} from '@mui/icons-material';
import { Box, Divider, IconButton, Link, Stack, Typography } from '@mui/material';
import React from 'react';

export default function AboutComponent() {
    return (
        <Box sx={{ p: 3, maxWidth: 600 }}>
            <Stack spacing={4}>
                <Stack spacing={2}>
                    <Typography variant="body1" color="text.secondary" sx={{ lineHeight: 2 }}>
                        FliP Flight Planner
                        <br />
                        Made with{' '}
                        <FavoriteIcon sx={{ color: 'red', fontSize: 20, verticalAlign: 'middle' }} /> by{' '}
                        <Link href="https://mustelinae.net" target="_blank" rel="noopener">
                            Boris Grozev
                        </Link>{' '}
                        <IconButton href="https://www.instagram.com/zoideeey/" size="small">
                            <InstagramIcon fontSize="small" />
                        </IconButton>
                    </Typography>

                    <Typography variant="body1" color="text.secondary" sx={{ lineHeight: 2 }}>
                        FliP is{' '}
                        <Link href="https://github.com/bgrozev/flip" target="_blank" rel="noopener">
                            open-source software
                        </Link>
                    </Typography>

                    <Typography variant="body1" color="text.secondary" sx={{ lineHeight: 2 }}>
                        Check it out on:
                        <IconButton href="https://github.com/bgrozev/flip" size="small">
                            <GitHubIcon fontSize="small" />
                        </IconButton>
                        <IconButton href="https://www.facebook.com/groups/1160799535728394" size="small">
                            <FacebookIcon fontSize="small" />
                        </IconButton>
                        <IconButton href="https://www.instagram.com/flip_flight_planner" size="small">
                            <InstagramIcon fontSize="small" />
                        </IconButton>
                    </Typography>

                    <Typography variant="body1" color="text.secondary" sx={{ lineHeight: 2 }}>
                        Special thanks to the Canadian CP Team.
                    </Typography>
                </Stack>

                <Divider />

                <Stack spacing={2}>
                    <Typography variant="caption" color="text.secondary" sx={{ lineHeight: 1.8 }}>
                        Powered by{' '}
                        <Link href="https://flysight.ca/" target="_blank" rel="noopener">
                            FlySight
                        </Link>
                        .
                    </Typography>

                    <Typography variant="caption" color="text.secondary" sx={{ lineHeight: 1.8 }}>
                        Winds forecast from{' '}
                        <Link href="https://www.markschulze.net/winds/" target="_blank" rel="noopener">
                            Winds Aloft by Mark Schulze
                        </Link>{' '}
                        and{' '}
                        <Link href="https://open-meteo.com/" target="_blank" rel="noopener">
                            OpenMeteo
                        </Link>
                        .
                    </Typography>

                    <Typography variant="caption" color="text.secondary" sx={{ lineHeight: 1.8 }}>
                        Ground winds from:{' '}
                        <Link href="https://sanmarcosclock.skydivespaceland.com/" target="_blank" rel="noopener">
                            Spaceland Load Clock
                        </Link>
                        ,{' '}
                        <Link href="https://wx.skydivecsc.com/" target="_blank" rel="noopener">
                            CSC Weather
                        </Link>
                        , and{' '}
                        <Link href="https://axis.tools/tool_Cond.php" target="_blank" rel="noopener">
                            AXIS Tools
                        </Link>
                        .
                    </Typography>
                </Stack>
            </Stack>
        </Box>
    );
}
