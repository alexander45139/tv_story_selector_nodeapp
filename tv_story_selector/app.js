const express = require('express');
const bodyParser = require('body-parser');
const rp = require('request-promise');
const db = require('./db');
const app = express();
app.use(bodyParser.urlencoded({extended: false}));
const port = 3000;

class Episode {
    constructor(seasonNumber, episodeNumber, name, description, duration) {
        this.seasonNumber = seasonNumber;
        this.episodeNumber = episodeNumber;
        this.name = name;
        this.description = description;
        this.duration = duration;
    }
}

class Story {
    constructor(name, episodes, numberOfEpisodes, description, duration, seriesId) {
        this.Name = name;
        this.Episodes = episodes;
        this.NumberOfEpisodes = numberOfEpisodes;
        this.Description = description;
        this.DurationMinutes = duration;
        this.SeriesID = seriesId;
    }
}

async function getAllSeries() {
    let status = 500, data = null;
    try {
		const sql = 'SELECT SeriesID, Name, Premiered, TvMazeID, EpisodateID, ImdbID FROM Series';
		const rows = await db.query(sql);

		if (rows) {
			status = 200;
			data = {
				'series': rows
			};
		} else {
			status = 204;
		}
    } catch(e) {
        console.error(e);
    }
    
    return {status, data};
}

async function getSeriesId(req) {
    let status = 500, data = null;
    try {
        const name = req.query.name;
        const premiered = req.query.premiered;
        if (name && premiered) {
            const sql = 'SELECT SeriesID FROM Series WHERE Name = ? AND Premiered = ? LIMIT 1';
    		const rows = await db.query(sql, [name, premiered]);
    
    		if (rows) {
    			status = 200;
    			data = {
    				'seriesId': rows[0].SeriesID
    			};
    		} else {
    			status = 204;
    		}
        } else {
            status = 400;
        }
    } catch(e) {
        console.error(e);
    }
    
    return {status, data};
}

async function getSeries(req) {
    let status = 500, data = null;
    try {
        const seriesId = req.query.seriesid ? req.query.seriesid : req.body.seriesid;
        if (seriesId && seriesId.length > 0 && seriesId.length <= 32) {
            const sql = 'SELECT SeriesID, Name, Premiered, TvMazeID, EpisodateID, ImdbID FROM Series WHERE SeriesID = ? LIMIT 1';
    		const rows = await db.query(sql, [seriesId]);
    
    		if (rows) {
    			status = 200;
    			data = {
    				'seriesId': rows[0].SeriesID,
    				'name': rows[0].Name,
    				'premiered': rows[0].Premiered,
    				'tvMazeId': rows[0].TvMazeID,
    				'episodateId': rows[0].EpisodateID,
    				'imdbId': rows[0].ImdbID
    			};
    		} else {
    			status = 204;
    		}
        } else {
            status = 400;
        }
    } catch(e) {
        console.error(e);
    }
    
    return {status, data};
}

async function getStories(req) {
    let status = 500, data = null;
    try {
		const seriesid = req.query.seriesid;
        const maxlastwatched = req.query.maxlastwatched ? req.query.maxlastwatched : new Date().toISOString().replace("T", " ").replace("Z", "");

		if (seriesid && seriesid.length > 0 && seriesid.length <= 32) {
			const sql = 'SELECT StoryID, Name, Episodes, NumberOfEpisodes, Description, DurationMinutes, LastWatched FROM Stories'
                        + ' WHERE SeriesID = ? AND (LastWatched <= ? OR LastWatched IS NULL)';
			const rows = await db.query(sql, [seriesid, maxlastwatched]);
			
			const sql2 = 'SELECT Name, Premiered FROM Series WHERE SeriesID = ? LIMIT 1';
			const rows2 = await db.query(sql2, [seriesid]);
			
			if (rows && rows2) {
				status = 200;
				data = {
					'seriesid': seriesid,
					'stories': rows,
                    'series': rows2[0]
				};
			} else {
				status = 204;
			}
		} else {
			status = 400;
		}
    } catch(e) {
        console.error(e);
    }
    
    return {status, data};
}

async function getNumberOfEpisodesInDb(req) {
    let status = 500, data = null;
    try {
		const seriesid = req.body.seriesid ? req.body.seriesid : req.query.seriesid;
		if (seriesid && seriesid.length > 0 && seriesid.length <= 32) {
			const sql = 'SELECT SUM(NumberOfEpisodes) AS NumberOfEpisodes FROM Stories WHERE SeriesID = ?';
			const rows = await db.query(sql, [seriesid]);
			
			if (rows) {
				status = 200;
				data = {
					'seriesid': seriesid,
					'numberofepisodes': rows[0].NumberOfEpisodes
				};
			} else {
				status = 204;
			}
		} else {
			status = 400;
		}
    } catch(e) {
        console.error(e);
    }
    
    return {status, data};
}

async function getEpisodes(tvMazeId, episodateId, imdbId) {
    const episodes = [];
    
    let results = null,
	    eps = null,
	    ep = null;
	
	if (tvMazeId !== null) {
	    results = await rp({
            method: 'GET',
            url: `https://api.tvmaze.com/shows/${tvMazeId}/episodes?specials=1`,
            json: true
        }).catch((err) => console.log(err));
        
        for (let epIndex in results) {
            ep = results[epIndex];
            episodes.push(new Episode(ep.season, ep.number, ep.name, ep.summary, ep.runtime));
        }
	} else if (episodateId !== null) {
	    results = await rp({
            method: 'GET',
            url: `https://www.episodate.com/api/show-details?q=${episodateId}`,
            json: true
        }).catch((err) => console.log(err));
        
        eps = results.tvShow.episodes;

        for (let epIndex in eps) {
            ep = eps[epIndex];
            episodes.push(new Episode(ep.season, ep.episode, ep.name, null, null));
        }
	} else if (imdbId !== null) {
        const getImdbEpisodes = async (season) => {
            results = await rp({
                method: 'GET',
                url: `https://imdb-api.com/en/API/SeasonEpisodes/k_m03a8t76/${imdbId}/${season}`,
                json: true
            }).catch((err) => console.log(err));
            
            return results.episodes;
        }

        eps = [];

        let showSeason = 1;

        let seasonEpisodes = await getImdbEpisodes(showSeason);

        while (seasonEpisodes && seasonEpisodes.length > 0) {
            eps = eps.concat(seasonEpisodes);
            showSeason += 1;
            seasonEpisodes = await getImdbEpisodes(showSeason);
        }

        for (let epIndex in eps) {
            ep = eps[epIndex];
            episodes.push(new Episode(ep.seasonNumber, ep.episodeNumber, ep.title, ep.plot, null));
        }
	}
	
	return episodes;
}

async function isSeriesInDb(seriesName, premieredYear) {
    let doesExist = null;
    try {
		if (seriesName && premieredYear) {
			const sql = 'SELECT SeriesID, Name, Premiered, TvMazeID, EpisodateID, ImdbID FROM Series WHERE Name = ? AND Premiered = ?';
			const rows = await db.query(sql, [seriesName, premieredYear]);
			
			if (rows) {
			    if (rows.length > 0) {
			        doesExist = true;
			    } else {
			        doesExist = false;
			    }
			}
		}
    } catch(e) {
        console.error(e);
    }
    
    return doesExist;
}

async function postSeries(req) {
	let status = 500,
		data = null;
	try {
		const name = req.body.name;
		const premiered = req.body.premiered;
        const image = req.body.image;
		const tvMazeId = req.body.tvmazeid;
		const episodateId = req.body.episodateid;
		const imdbId = req.body.imdbid;
		
		if (name && premiered && (tvMazeId || episodateId || imdbId) && !(await isSeriesInDb(name, premiered))) {
		    const sql = 'INSERT INTO Series (Name, Premiered, Image, TvMazeID, EpisodateID, ImdbID)'
					+ ' VALUES (?, ?, ?, ?, ?, ?)';
			const result = await db.query(sql, [name, premiered, image, tvMazeId, episodateId, imdbId]);
		
    		if (result.affectedRows) {
    			status = 201;
    			data = {'id': result.insertId};
    		}
		} else {
			status = 400;
		}
	} catch(e) {
		console.error(e);
	}
	
	return {status, data};
}

function sortStory(story, seriesId) {
    let name = null,
        episodes = null,
        numberOfEpisodes = null,
        description = null,
        duration = null;
        
    if (story) {
        if (story.length > 1) {
            name = story[0].name;
            
            const firstEp = name;
            
            [", part", ": part", " part", ", Part", ": Part", " Part", ", Part", ": Part", " Part", " (1)", " (i)"].forEach(multiPartSplit => {
                if (firstEp.includes(multiPartSplit)) {
                    name = firstEp.split(multiPartSplit)[0];
                }
            });
            
            episodes = `S${story[0].seasonNumber}E${story[0].episodeNumber}: ${story[0].name}`;
            duration = story[0].duration ? story[0].duration : null;
            
            let episodeIndex = 1,
                episode;
            
            while (episodeIndex < story.length) {
                episode = story[episodeIndex];
                episodes += `, S${episode.seasonNumber}E${episode.episodeNumber}: ${episode.name}`;
                if (duration) {
                    duration += episode.duration;
                }
                episodeIndex += 1;
            }
            
            numberOfEpisodes = story.length;
            description = story[0].description;
            seriesId;
        } else {
            name = story.name;
            episodes = `S${story.seasonNumber}E${story.episodeNumber}: ${story.name}`;
            numberOfEpisodes = 1;
            description = story.description;
            duration = story.duration;
            seriesId;
        }
    }
    
    return new Story(name, episodes, numberOfEpisodes, description, duration, seriesId);
}

async function postStories(req) {
	let status = 500,
		data = null;
	try {
		const seriesId = req.body.seriesid;
		
		const fetchedSeries = seriesId ? await getSeries(req) : null;
		
		if (seriesId && fetchedSeries.status == 200) {
		    const getWikiContent = async (title) => {
                let content = null;
                
                const pageData = await rp({
                    method: 'GET',
                    url: `https://en.wikipedia.org/w/api.php?action=parse&page=${encodeURI(title)}&format=json`,
                    json: true
                }).catch((err) => console.log(err));
                
                const text = pageData.content.parse.text;
                      content = Object.getOwnPropertyDescriptor(text, "*").value;
                
                return content;
            }
            
            const getMultiPartEpisode = async (epName, showName) => {
                let resultsTitles = null,
                    resultsURLs = null;
                
                let searchData = await rp({
                    method: 'GET',
                    url: `https://en.wikipedia.org/w/api.php?action=opensearch&search=${encodeURI(epName)} ${encodeURI(showName)}`,
                    json: true
                }).catch((err) => console.log(err));
                
                if (searchData.results) {
                    resultsTitles = searchData.results[1];
                    resultsURLs = searchData.results[3];
                }
                  
                if (resultsURLs === null || resultsURLs === undefined || resultsURLs.length < 1) {
                    searchData = await rp({
                        method: 'GET',
                        url: `https://en.wikipedia.org/w/api.php?action=opensearch&search=${encodeURI(epName)}`,
                        json: true
                    }).catch((err) => console.log(err));
                    
                    if (searchData.results) {
                        resultsTitles = searchData.results[1];
                        resultsURLs = searchData.results[3];
                    }
                }
                
                let part = null;
                
                if (resultsTitles) {
                    let wTitle = null;
                    
                    if (resultsTitles.length > 1) {
                        let ri = 0,
                            definitelyFound = false;
                            
                        while (ri < resultsTitles.length) {
                            const urlSplt = resultsURLs[ri].split(`/`);
                            
                            if (resultsTitles[ri].includes(`episode`) && !resultsTitles[ri].includes(`novel`)) {
                                wTitle = urlSplt[urlSplt.length - 1];
                                definitelyFound = true;
                            } else if ((resultsTitles[ri].includes(showName) && !resultsTitles[ri].includes(`novel`)) || resultsTitles[ri] === currentEpisode) {
                                wTitle = urlSplt[urlSplt.length - 1];
                            }
                            
                            if (definitelyFound) {
                                ri = resultsTitles.length;
                            }
                            
                            ri += 1;
                        }
                    } else if (resultsURLs.length > 0) {
                        const splt = resultsURLs[0].split(`/`);
                        wTitle = splt[splt.length - 1];
                    }
                    
                    if (wTitle) {
                        let html = await getWikiContent(wTitle);
                        
                        if (html && html.includes('<div class="redirectMsg">')) {
                            wTitle = html.substr(html.indexOf('<a href="/wiki/') + 15).split('"')[0];
                            
                            html = await getWikiContent(wTitle);
                        }
                        
                        if (html) {
                            const desc = html.split('<h2><span class="mw-headline"')[0];
                            
                            if (desc && desc.includes("-part story")) {
                                const section = desc.substr(desc.indexOf('-part story') - 20);
                                
                                if (section.includes("first ") || section.includes("1st ")) {
                                    part = "first";
                                } else {
                                    part = "next";
                                }
                            }
                        }
                    }
                }
                
                return part;
            }
		    
		    data = [];
		    
		    const series = fetchedSeries.data,
		          episodes = await getEpisodes(series.tvMazeId, series.episodateId, series.imdbId),
		          fetchedNumberOfEpisodesInDb = await getNumberOfEpisodesInDb(req);
		    
		    let epIndex = 0,
                currentEpisode,
                nextEpisode,
                story,
                epInfo;

            const stories = [];
                
            if (fetchedNumberOfEpisodesInDb.status == 200) {
                const numberOfEpisodesInDb = parseInt(fetchedNumberOfEpisodesInDb.data.numberofepisodes, 10);
                if (numberOfEpisodesInDb < episodes.length) {
                    epIndex = numberOfEpisodesInDb;
                } else if (numberOfEpisodesInDb > episodes.length && numberOfEpisodesInDb == episodes.length) {
                    epIndex = null;
                }
            } else if (fetchedNumberOfEpisodesInDb.status == 500) {
                epIndex = null;
            }

            if (epIndex != null) {
                while (epIndex < episodes.length) {
                    currentEpisode = episodes[epIndex];
                    nextEpisode = episodes[epIndex + 1] ? episodes[epIndex + 1] : null;
                    story = [];
                    
                    if ((currentEpisode.name.endsWith(`(1)`) && nextEpisode.name.endsWith(`(2)`)
                        || (currentEpisode.name.toLowerCase().includes(`part one`) && nextEpisode.name.toLowerCase().includes(`part two`))
                        || (currentEpisode.name.toLowerCase().includes(`part 1`) && nextEpisode.name.toLowerCase().includes(`part 2`))
                        || (currentEpisode.name.toLowerCase().includes(`part i`) && nextEpisode.name.toLowerCase().includes("part ii"))
                        || (currentEpisode.name.toLowerCase().includes(`chapter one`) && nextEpisode.name.toLowerCase().includes(`chapter two`))
                        || (currentEpisode.name.toLowerCase().includes(`chapter 1`) && nextEpisode.name.toLowerCase().includes(`chapter 2`))
                        || (
                            nextEpisode
                            && (
                                currentEpisode.name.replace(` 1`, ``) === nextEpisode.name.replace(` 2`, ``)
                                && !currentEpisode.name.toLowerCase().includes(`episode`)
                            )
                        )
                    )) {
                        story.push(currentEpisode, nextEpisode);
                        epIndex += 2;
                        let part = 3;
                        
                        while (
                            epIndex < episodes.length
                            &&
                            (
                                !episodes[epIndex].name.toLowerCase().includes(`part one`)
                                && (
                                    !episodes[epIndex].name.toLowerCase().includes(`part 1`)
                                    || episodes[epIndex].name.toLowerCase().includes(`part 10`)
                                )
                                && !episodes[epIndex].name.toLowerCase().includes(`part i`)
                                && !episodes[epIndex].name.toLowerCase().includes(`chapter one`)
                                && (
                                    !episodes[epIndex].name.toLowerCase().includes(`chapter 1:`)
                                    || !episodes[epIndex].name.toLowerCase().includes(`chapter 1 `)
                                )
                            )
                            &&
                            (
                                episodes[epIndex].name.endsWith(`(${part})`)
                                || episodes[epIndex].name.toLowerCase().includes(`part `)
                                || episodes[epIndex].name.toLowerCase().includes(`chapter `)
                                || (
                                  episodes[epIndex + 1]
                                  && (episodes[epIndex].name.replace(` ${part}`, ``) === episodes[epIndex + 1].name.replace(` ${part + 1}`, ``))
                                )
                            )
                        ) {
                            story.push(episodes[epIndex]);
                            part += 1;
                            epIndex += 1;
                        }
                        
                        stories.push(sortStory(story, seriesId));
                    } else {
                        epInfo = await getMultiPartEpisode(currentEpisode.name, series.name);
                        
                        if (epInfo === "first") {
                            story.push(currentEpisode, nextEpisode);
                            epIndex += 2;
                            
                            epInfo = await getMultiPartEpisode(episodes[epIndex].name, series.name);
                            
                            while (epInfo === "next") {
                                story.push(episodes[epIndex]);
                                epIndex += 1;
                                epInfo = await getMultiPartEpisode(episodes[epIndex].name, series.name);
                            }
                            
                            stories.push(sortStory(story, seriesId));
                        } else {
                            stories.push(sortStory(currentEpisode, seriesId));
                            epIndex += 1;
                        }
                    }
                }

                let sql = 'INSERT INTO Stories (Name, Episodes, NumberOfEpisodes, Description, DurationMinutes, SeriesID) VALUES ';

                const values = [];

                let stryIndex = 0,
                    stry;

                while (stryIndex < stories.length) {
                    stry = stories[stryIndex];

                    sql += '(?, ?, ?, ?, ?, ?)' + ((stryIndex < stories.length - 1) ? ', ' : '');

                    values.push(
                        stry.Name,
                        stry.Episodes,
                        stry.NumberOfEpisodes,
                        stry.Description,
                        stry.DurationMinutes,
                        stry.SeriesID
                    );

                    stryIndex += 1;
                }
                
                const result = await db.query(sql, values);
                
                if (result.affectedRows) {
                    status = 201;
                    data = {'rows': result.affectedRows};
                }
            }
		} else {
			status = 400;
		}
	} catch(e) {
		console.error(e);
	}
	
	return {status, data};
}

async function markStoryAsWatched(req) {
	let status = 500,
		data = null;
	try {
		const storyid = req.body.storyid;
		if (storyid) {
            const dateToday = new Date().toISOString().replace("T", " ").replace("Z", "");

			const sql = 'UPDATE Stories SET LastWatched = ? WHERE StoryID = ?';
			const result = await db.query(sql, [dateToday, storyid]);
			
			if (result.affectedRows) {
				status = 201;
				data = {'changed rows': result.changedRows};
			}
		} else {
			status = 400;
		}
	} catch(e) {
		console.error(e);
	}
	
	return {status, data};
}

app.get('/tv_story_selector/getAllSeries', async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin','*');
    const {status, data} = await getAllSeries();
    res.status(status);
    if (data) {
        res.json(data);
    } else {
        res.end();
    }
})

app.get('/tv_story_selector/getSeriesId', async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin','*');
    const {status, data} = await getSeriesId(req);
    res.status(status);
    if (data) {
        res.json(data);
    } else {
        res.end();
    }
})

app.get('/tv_story_selector/getSeries', async (req, res) => {
    const {status, data} = await getSeries(req);
    res.status(status);
    if (data) {
        res.json(data);
    } else {
        res.end();
    }
})

app.get('/tv_story_selector/getStories', async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin','*');
    const {status, data} = await getStories(req);
    res.status(status);
    if (data) {
        res.json(data);
    } else {
        res.end();
    }
})

app.post('/tv_story_selector/postSeries', async (req, res) => {
    const {status, data} = await postSeries(req);
    res.status(status);
    if (data) {
        res.json(data);
    } else {
        res.end();
    }
})

app.post('/tv_story_selector/postStories', async (req, res) => {
    const {status, data} = await postStories(req);
    res.status(status);
    if (data) {
        res.json(data);
    } else {
        res.end();
    }
})

app.post('/tv_story_selector/markStoryAsWatched', async (req, res) => {
    const {status, data} = await markStoryAsWatched(req);
    res.status(status);
    if (data) {
        res.json(data);
    } else {
        res.end();
    }
})

app.put('/report_pothole_app', async (req, res) => {
    res.status(405);
	res.end();
})

app.delete('/tv_story_selector', async (req, res) => {
	res.status(405);
	res.end();
})

app.listen(port, () => {
    console.log(`Running at http://localhost:${port}`)
})
