(function initDataModel(globalScope, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (globalScope) globalScope.RelationshipDataModel = api;
})(typeof window !== 'undefined' ? window : globalThis, function createDataModelApi() {
  'use strict';

  const clone = value => JSON.parse(JSON.stringify(value));
  const linkKey = (personId, matterId) => `${personId}:${matterId}`;

  function normalizeData(source) {
    const data = clone(source || {});
    data.people = Array.isArray(data.people) ? data.people : [];
    data.matters = Array.isArray(data.matters) ? data.matters : [];
    const peopleIds = new Set(data.people.map(person => person.id));
    const matterIds = new Set(data.matters.map(matter => matter.id));
    const links = new Map();

    (data.person_matter_links || []).forEach(link => {
      if (!peopleIds.has(link.person_id) || !matterIds.has(link.matter_id)) return;
      links.set(linkKey(link.person_id, link.matter_id), {
        person_id: link.person_id,
        matter_id: link.matter_id,
        role: link.role || '相关人员'
      });
    });
    data.people.forEach(person => {
      (person.related_matter_ids || []).forEach(matterId => {
        if (!matterIds.has(matterId)) return;
        const key = linkKey(person.id, matterId);
        if (!links.has(key)) links.set(key, { person_id: person.id, matter_id: matterId, role: '相关人员' });
      });
    });
    data.matters.forEach(matter => {
      if (!peopleIds.has(matter.person_id)) return;
      const key = linkKey(matter.person_id, matter.id);
      if (!links.has(key)) links.set(key, { person_id: matter.person_id, matter_id: matter.id, role: '相关人员' });
    });
    data.person_matter_links = [...links.values()];
    return data;
  }

  function linkedMatterIds(data, personId) {
    return (data.person_matter_links || [])
      .filter(link => link.person_id === personId)
      .map(link => link.matter_id);
  }

  function linkedPersonIds(data, matterId) {
    return (data.person_matter_links || [])
      .filter(link => link.matter_id === matterId)
      .map(link => link.person_id);
  }

  function upsertPersonMatterLink(data, personId, matterId, role = '相关人员') {
    data.person_matter_links ||= [];
    const found = data.person_matter_links.find(link => link.person_id === personId && link.matter_id === matterId);
    if (found) {
      found.role = role || '相关人员';
      return found;
    }
    const link = { person_id: personId, matter_id: matterId, role: role || '相关人员' };
    data.person_matter_links.push(link);
    return link;
  }

  function removePersonMatterLink(data, personId, matterId) {
    data.person_matter_links = (data.person_matter_links || [])
      .filter(link => link.person_id !== personId || link.matter_id !== matterId);
  }

  return {
    linkedMatterIds,
    linkedPersonIds,
    normalizeData,
    removePersonMatterLink,
    upsertPersonMatterLink
  };
});
