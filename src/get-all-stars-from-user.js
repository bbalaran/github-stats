import Promise from 'bluebird';
import parse from 'parse-link-header';
import parseRepos from './parsing/parse-repos';
import _ from 'lodash';
import winston from 'winston';
const request = Promise.promisifyAll(require('superagent'));
/**
 *
 * @param {Github} ghcp - authenticated github client with promisified async methods
 * @param {String} user - user name
 * @param {Number} maxPagination - max paginated requests
 * @param {Number} perPage - number per page
 */
export default async (ghcp, user, maxPagination, perPage) => {
  let per_page = perPage || 100;
  let maxPages = maxPagination || 10;
  let starData = await request.getAsync(`https://dpastoor:${process.env.GHPW}@api.github.com/users/${user}/starred?per_page=${per_page}`);
  let starredRepos = parseRepos(starData.body);
  let maxLinks = per_page;
  let linksPulled = 1;
  if (starData.headers.hasOwnProperty('links')) {
    let links = parse(starData.headers.link);
    maxLinks = per_page*links.last.page;
    linksPulled = Math.min(maxPages, parseInt(links.last.page) + 1);
    let starsPromises = _.map(_.range(2, linksPulled), function(pageNum) {
      winston.log('info', 'fetching star data : ' + pageNum + 'for user ' + user);
      return ghcp.repos.getStarredFromUserAsync({
        user: user,
        page: pageNum,
        per_page: per_page
      });
    });
    let remainingStarred = await Promise.all(starsPromises);
    starredRepos.push(_.map(remainingStarred, parseRepos));
  }
  return {download_info: {dl_time: new Date(), linksPulled, maxLinks}, starredRepos};
};